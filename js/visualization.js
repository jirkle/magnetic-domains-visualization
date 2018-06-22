//Server
var server_address = "localhost"
var server_port = 80

//State properties
var data = {}
var angle = 0
var angles = []
var measurement = 0
var measurements = []
var selectedPoint = {"x1": 0, "y1": 0}
var selectedSquare = {"x1": 50, "y1": 50, "x2": 200, "y2": 200}
var pointMode = false
var image //Image handler
var overlay //Image overlay handler
var imageData //Data for visualization
var gw = 1000
var gh = 1000
var action = undefined
var dragStarted = false
var cursorStyle = document.body.style.cursor

//Visual & rendering properties
var cornerActionRadius = 50
var edgeActionRadius = 50
var chosenSize = 10;
var borderSize = 1;
var shadeColor = "#00000088"

//****************
// Initialization
//****************

google.charts.load('current', {'packages':['corechart']})

$.ajax( {url: "http://" + server_address + ":" + server_port + "/metadata", type: "GET", success: function(metadata) {
	angles = metadata["angles"]
	measurements = metadata["measurements"]
    $( document ).ready( function() {
		init()
	} );
}} );

function init() {
	//init data data structure - create dict & lists of given length
	image = document.getElementById("image");
	overlay = document.getElementById("overlay");
	$.each( angles, function( index, a ) {
		data[a] = new Array(measurements[index])
	} )

	//init visual elements - angles & measurements select box, canvas
	$.each( angles, function( index, a ) {
		$("#angles").append( $("<option></option>", {value: a, text: a + "°"}) )
	} )
	$("#angles").val(angle)
	refreshMeasurements()
	d3.select("body")
		.select("#image")
		.attr("width", gw)
		.attr("height", gh)
	
	//get data for angle and measurement
	getAsyncData().done(function() {
		//select middle point
		imageData = getData()
		selectedPoint = { "x1": imageData["width"] / 2, "y1": imageData["height"] / 2}

		//show data
		//Enter point selection mode
		enterPointMode()
		redrawImage()
	});

	//Register change listeners

	$("#angles").change( onAngleChanged )

	$("#measurements").change( onMeasurementChanged )
	
	$("#point-selection").on( "click", function(e) {
		enterPointMode()
	});

	$("#region-selection").on( "click", function(e) {
		enterRegionMode()
	});
}

function onAngleChanged() {
	angle = parseInt( $( "#angles" ).val() )
	showLoader()
	$("#measurements").unbind()
	refreshMeasurements()
	$("#measurements").change( onMeasurementChanged )
	getAsyncData().done( function() {
		redrawOverlay()
		onSelectionChanged()
		redrawImage()
	})
}

function onMeasurementChanged() {
	measurement = parseInt($("#measurements").val())
	showLoader()
	getAsyncData().done( function() {
		redrawOverlay()
		onSelectionChanged()
		redrawImage()
	})
}

function onSelectionChanged() {
	if ( pointMode ) {
		$("#info").html("Selected pixel x = " + selectedPoint["x1"] + ", y = " + selectedPoint["y1"] + ".")
		drawIntensityChart()
	} else {
		$("#info").html("Selected rect x1 = " + selectedSquare["x1"] + ", y1 = " + selectedSquare["y1"] + ", x2 = " + selectedSquare["x2"] + ", y2 = " + selectedSquare["y2"] + ".")
		drawHistogram()
	}
}

function showLoader() {
	$("#loader").css("display", "block")
}

function hideLoader() {
	$("#loader").css("display", "none")
}

function refreshMeasurements() {
	$("#measurements").empty()
	index = angles.indexOf(angle)
	measurementsCount = measurements[index]
	for ( var i = 0; i < measurementsCount; i++ ) {
		$("#measurements").append( $("<option></option>", {value: i, text: (i + 1)}))
	}
	$("#measurements").val(measurement)
}

function getAsyncData() {
	var promise = jQuery.Deferred();
	if ( !data[angle][measurement] ) {
		$.ajax( {url: "http://" + server_address + ":" + server_port + "/data?a=" + angle + "&n=" + measurement, type: "POST", success: function(d) {
			data[angle][measurement] = d
			imageData = d
			min = imageData["min"];
			max = imageData["max"];
			imageData["color"] = d3.scale.linear()
				.domain([min, max])
				.range(["black", "white"])
			promise.resolve( "done" )
		}} );
	} else { //We have the data cached => resolve now
		promise.resolve( "done" )
	}
	return promise.promise()
}

function getData() {
	if ( !data[angle][measurement] ) {
		getAsyncData()
		return undefined
	}
	return data[angle][measurement]
}

function enterPointMode() {
	if ( !pointMode ) {
		pointMode = true
		$(overlay).unbind()
		$(overlay).on("click", function(e) {
			lastX = selectedPoint["x1"]
			lastY = selectedPoint["y1"]
			chosenX = Math.round(e.originalEvent.offsetX/this.clientWidth * this.width)
			chosenY = Math.round(e.originalEvent.offsetY/this.clientHeight * this.height)
			selectedPoint = {"x1": chosenX, "y1": chosenY}
			dist = Math.round((chosenSize + borderSize) / 2 + 1)
			appendOverlayRegionToRender( {"x1": chosenX - dist, "y1": chosenY - dist, "x2": chosenX + dist, "y2": chosenY + dist} )
			appendOverlayRegionToRender( {"x1": lastX - dist, "y1": lastY - dist, "x2": lastX + dist, "y2": lastY + dist} )
			onSelectionChanged()
		});
		onSelectionChanged()
		redrawOverlay()
	}
}

function enterRegionMode() {
	if ( pointMode ) {
		pointMode = false
		$(overlay).unbind()
		$(overlay).on( "mousemove", function(e) {
			e.preventDefault()
			if ( !dragStarted ) {
				hoveredX = Math.round(e.originalEvent.offsetX/this.clientWidth * this.width)
				hoveredY = Math.round(e.originalEvent.offsetY/this.clientHeight * this.height)
				action = "move"
				width = selectedSquare["x2"] - selectedSquare["x1"]
				height = selectedSquare["y2"] - selectedSquare["y1"]
				actionRadius = Math.min(width/2, height/2, cornerActionRadius)
				//Top edge
				region = {"x1": selectedSquare["x1"], "x2": selectedSquare["x2"], "y1": selectedSquare["y1"] - actionRadius, "y2": selectedSquare["y1"] + actionRadius }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "top"
				}
				//Bottom edge
				region = {"x1": selectedSquare["x1"], "x2": selectedSquare["x2"], "y1": selectedSquare["y2"] - actionRadius, "y2": selectedSquare["y2"] + actionRadius }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "bottom"
				}
				//Left edge
				region = {"x1": selectedSquare["x1"] - actionRadius, "x2": selectedSquare["x1"] + actionRadius, "y1": selectedSquare["y1"], "y2": selectedSquare["y2"] }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "left"
				}
				//Right edge
				region = {"x1": selectedSquare["x2"] - actionRadius, "x2": selectedSquare["x2"] + actionRadius, "y1": selectedSquare["y1"], "y2": selectedSquare["y2"] }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "right"
				}
				//Left top corner
				region = {"x1": selectedSquare["x1"] - actionRadius, "x2": selectedSquare["x1"] + actionRadius, "y1": selectedSquare["y1"] - actionRadius, "y2": selectedSquare["y1"] + actionRadius }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "lefttop"
				}
				//Right top corner
				region = {"x1": selectedSquare["x2"] - actionRadius, "x2": selectedSquare["x2"] + actionRadius, "y1": selectedSquare["y1"] - actionRadius, "y2": selectedSquare["y1"] + actionRadius }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "righttop"
				}
				//Left bottom corner
				region = {"x1": selectedSquare["x1"] - actionRadius, "x2": selectedSquare["x1"] + actionRadius, "y1": selectedSquare["y2"] - actionRadius, "y2": selectedSquare["y2"] + actionRadius }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "leftbottom"
				}
				//Right bottom corner
				region = {"x1": selectedSquare["x2"] - actionRadius, "x2": selectedSquare["x2"] + actionRadius, "y1": selectedSquare["y2"] - actionRadius, "y2": selectedSquare["y2"] + actionRadius }
				if( isInRegion(region, hoveredX, hoveredY) ) {
					action = "rightbottom"
				}
				switch ( action ) {
					case "move":
						document.body.style.cursor = "move"
						break
					case "top":
					case "bottom":
						document.body.style.cursor = "ns-resize"
						break
					case "left":
					case "right":
						document.body.style.cursor = "ew-resize"
						break
					case "lefttop":
					case "rightbottom":
						document.body.style.cursor = "nwse-resize"
						break
					case "righttop":
					case "leftbottom":
						document.body.style.cursor = "nesw-resize"
						break
				}
				
			}
			//change mouse icon appropriatelly
		} )
		
		$(overlay).on( "onmouseenter", function(e) {
			cursorStyle = document.style.cursor
			//resolve dragged corner / edge / whole region
		} )	

		$(overlay).on( "onmouseout", function(e) {
			document.body.style.cursor = cursorStyle
			//resolve dragged corner / edge / whole region
		} )	
			
		$(overlay).on( "dragstart", function(e) {
			dragStarted = true
			//resolve dragged corner / edge / whole region
		} )
		$(overlay).on( "drag", function(e) {
			//redraw region
			onSelectionChanged()
			redrawOverlay()
		} )
		$(overlay).on( "dragend", function(e) {
			//end
			dragStarted = false
			onSelectionChanged()
			redrawOverlay()
		} )
		onSelectionChanged()
		redrawOverlay()
	}
}

function isInRegion(square, x, y) {
	return x >= square["x1"] && x <= square["x2"] && y >= square["y1"] && y <= square["y2"]
}

function drawIntensityChart() {
	$.ajax( {
		url: "http://" + server_address + ":" + server_port + "/point?x1=" + (selectedPoint["x1"] + 1) + "&y1=" + (selectedPoint["y1"] + 1),
		type: "POST",
		success: function(point) {
			$('#chart').empty()

			values = []
			$(point).each( function( index, p ) {
				val = []
				val.push(p["a"])
				intensities = []
				$( p["measurements"] ).each( function( index, p ) {
					intensities.push(p["i"])
				} )
				intensities.sort()
				val.push(d3.quantile(intensities, 0))
				val.push(d3.quantile(intensities, 0.25))
				val.push(d3.quantile(intensities, 0.75))
				val.push(d3.quantile(intensities, 1))
				values.push(val)
			} )

			var d = google.visualization.arrayToDataTable(values, true);

    		var options = {
        		title: 'Intensity based on angle',
    	    	legend: { position: 'bottom' },
    	    	vAxis: { maxValue: 20000 }
    		};

    		var chart = new google.visualization.CandlestickChart(document.getElementById('chart'))
			chart.draw(d, options)
		}
	} )
}

function drawHistogram() {
	$('#chart').empty()
	values = [['Intensity']]
	d = imageData["rows"]
	for (var x = selectedSquare["x1"]; x <= selectedSquare["x2"]; x++) {
		for (var y = selectedSquare["y1"]; y <= selectedSquare["y2"]; y++) {
			values.push([parseInt(d[y][x])])
		}
	}

	var d = google.visualization.arrayToDataTable(values);
	var options = {
        title: 'Intensity histogram',
    	legend: { position: 'bottom' }
    };

	var chart = new google.visualization.Histogram(document.getElementById('chart'));
    chart.draw(d, options);
}