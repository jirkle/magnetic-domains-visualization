//Server
var server_address = "localhost"
var server_port = 80

//State properties
var data = {}
var angle = 0
var angles = []
var measurement = 0
var measurements = []
var selectedPoint = { "x1": 500, "y1": 500 }
var selectedSquare = { "x1": 450, "y1": 450, "x2": 550, "y2": 550 }
var pointMode = false
var image //Image handler
var overlay //Image overlay handler
var imageData //Data for visualization
var gw = 1000
var gh = 1000
var action = undefined
var dragStarted = false
var dragPos = { "x1": 0, "y1": 0 }
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
	
	//Buttons
	$("#point-selection").on( "click", function(e) {
		enterPointMode()
	})

	$("#region-selection").on( "click", function(e) {
		enterRegionMode()
	})
}

function onAngleChanged() {
	angle = parseInt( $( "#angles" ).val() )
	showLoader()
	$("#measurements").unbind()
	refreshMeasurements()
	$("#measurements").change( onMeasurementChanged )
	getAsyncData().done( function() {
		onSelectionChanged()
		redrawImage()
	})
}

function onMeasurementChanged() {
	measurement = parseInt($("#measurements").val())
	showLoader()
	getAsyncData().done( function() {
		
		onSelectionChanged()
		redrawImage()
	})
}

function onSelectionChanged() {
	redrawOverlay()
	if ( pointMode ) {
		$("#info").html("Selected pixel x = " + selectedPoint["x1"] + ", y = " + selectedPoint["y1"] + ".")
		redrawIntensityChart()
	} else {
		$("#info").html("Selected rect x1 = " + selectedSquare["x1"] + ", y1 = " + selectedSquare["y1"] + ", x2 = " + selectedSquare["x2"] + ", y2 = " + selectedSquare["y2"] + ".")
		redrawHistogram()
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
		$(document).unbind()
		$(overlay).unbind()
		$("#overlay")[0].style.cursor = ""
		$(overlay).on("click", function(e) {
			lastX = selectedPoint["x1"]
			lastY = selectedPoint["y1"]
			chosenX = Math.round(e.originalEvent.offsetX/this.clientWidth * this.width)
			chosenY = Math.round(e.originalEvent.offsetY/this.clientHeight * this.height)
			if(chosenX < 0) { chosenX = 0 }
			if(chosenX >= imageData["width"]) { chosenX = imageData["width"] - 1 }
			if(chosenY < 0) { chosenY = 0 }
			if(chosenY >= imageData["height"]) { chosenY = imageData["height"] - 1 }
			selectedPoint = {"x1": chosenX, "y1": chosenY}

			dist = Math.round((chosenSize + borderSize) / 2 + 1)
			appendRenderJob( { "x1": chosenX - dist, "y1": chosenY - dist, "x2": chosenX + dist, "y2": chosenY + dist, "function": redrawOverlayRect } )
			appendRenderJob( {"x1": lastX - dist, "y1": lastY - dist, "x2": lastX + dist, "y2": lastY + dist, "function": redrawOverlayRect} )
			onSelectionChanged()
		});
		onSelectionChanged()
	}
}

function enterRegionMode() {
	if ( pointMode ) {
		pointMode = false
		$(overlay).unbind()
		$(document).mousemove(function(e) {
			if ( !dragStarted ) {
				if( $(e.target).is("#overlay") ) {
					overlay = $("#overlay")[0]
					hoveredX = Math.round(e.offsetX/overlay.clientWidth * overlay.width)
					hoveredY = Math.round(e.offsetY/overlay.clientHeight * overlay.height)
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
							overlay.style.cursor = "move"
							break
						case "top":
						case "bottom":
							overlay.style.cursor = "ns-resize"
							break
						case "left":
						case "right":
							overlay.style.cursor = "ew-resize"
							break
						case "lefttop":
						case "rightbottom":
							overlay.style.cursor = "nwse-resize"
							break
						case "righttop":
						case "leftbottom":
							overlay.style.cursor = "nesw-resize"
							break
					}
				}
			} else {
				e.preventDefault()
				e.stopPropagation()
				delta = { "x1": e.pageX - dragPos["x1"], "y1": e.pageY - dragPos["y1"] }
				dragPos = { "x1": e.pageX, "y1": e.pageY }
				switch ( action ) {
					case "move":
						correctDelta( delta, { "x1": selectedSquare["x1"], "y1": selectedSquare["y1"] } )
						correctDelta( delta, { "x1": selectedSquare["x2"], "y1": selectedSquare["y2"] } )
						selectedSquare["x1"] += delta["x1"]
						selectedSquare["x2"] += delta["x1"]
						selectedSquare["y1"] += delta["y1"]
						selectedSquare["y2"] += delta["y1"]
						break
					case "top":
						correctDelta( delta, { "x1": 0, "y1": selectedSquare["y1"] } )
						selectedSquare["y1"] += delta["y1"]
						break
					case "bottom":
						correctDelta( delta, { "x1": 0, "y1": selectedSquare["y2"] } )
						selectedSquare["y2"] += delta["y1"]
						break
					case "left":
						correctDelta( delta, { "x1": selectedSquare["x1"], "y1": 0 } )
						selectedSquare["x1"] += delta["x1"]
						break
					case "right":
						correctDelta( delta, { "x1": selectedSquare["x2"], "y1": 0 } )
						selectedSquare["x2"] += delta["x1"]
						break
					case "lefttop":
						correctDelta( delta, { "x1": selectedSquare["x1"], "y1": selectedSquare["y1"] } )
						selectedSquare["x1"] += delta["x1"]
						selectedSquare["y1"] += delta["y1"]
						break
					case "rightbottom":
						correctDelta( delta, { "x1": selectedSquare["x2"], "y1": selectedSquare["y2"] } )
						selectedSquare["x2"] += delta["x1"]
						selectedSquare["y2"] += delta["y1"]
						break
					case "righttop":
						correctDelta( delta, { "x1": selectedSquare["x2"], "y1": selectedSquare["y1"] } )
						selectedSquare["x2"] += delta["x1"]
						selectedSquare["y1"] += delta["y1"]
						break
					case "leftbottom":
						correctDelta( delta, { "x1": selectedSquare["x1"], "y1": selectedSquare["y2"] } )
						selectedSquare["x1"] += delta["x1"]
						selectedSquare["y2"] += delta["y1"]
						break
				}
				//redraw region
				onSelectionChanged()
			}
		} )
			
		$(overlay).mousedown(function(e) {
			e.preventDefault()
			e.stopPropagation()
			dragStarted = true
			dragPos = { "x1": e.pageX, "y1": e.pageY }
			//resolve dragged corner / edge / whole region
		} )
		$(document).mouseup( function(e) {
			//end
			if(dragStarted) {
				dragStarted = false

				onSelectionChanged()
			}			
		} )
		onSelectionChanged()
	}
}

function isInRegion(square, x, y) {
	return x >= square["x1"] && x <= square["x2"] && y >= square["y1"] && y <= square["y2"]
}

function correctDelta(delta, point) {
	if ( point["x1"] + delta["x1"] < 0 ) {
		delta["x1"] = - point["x1"]
	} else if ( point["x1"] + delta["x1"] >= imageData["width"] ) {
		delta["x1"] = imageData["width"] - point["x1"] - 1
	}
	if ( point["y1"] + delta["y1"] < 0 ) {
		delta["y1"] = - point["y1"]
	} else if ( point["y1"] + delta["y1"] >= imageData["height"] ) {
		delta["y1"] = imageData["height"] - point["y1"] - 1
	}
	return delta
}