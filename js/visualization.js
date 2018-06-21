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
var selectedSquare = {"x1": 50, "y1": 50, "x2": 100, "y2": 100}
var pointMode = false
var image //Image handler
var overlay //Image overlay handler
var imageData //Data for visualization
var gw = 1000
var gh = 1000
var hoveredRegion = undefined

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
		redrawImage()
	})
}

function onMeasurementChanged() {
	measurement = parseInt($("#measurements").val())
	showLoader()
	getAsyncData().done( function() {
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
		$(overlay).on( "mouseover", function(e) {
			hoveredX = Math.round(e.originalEvent.offsetX/this.clientWidth * this.width)
			hoveredY = Math.round(e.originalEvent.offsetY/this.clientHeight * this.height)

			hoveredRegion = "center"
			//change mouse icon appropriatelly
		} )
		$(overlay).on( "dragstart", function(e) {
			//resolve dragged corner / edge / whole region
		} )
		$(overlay).on( "drag", function(e) {
			//redraw region
			onSelectionChanged()
		} )
		$(overlay).on( "dragend", function(e) {
			//end
			onSelectionChanged()
		} )
		onSelectionChanged()
		redrawOverlay()
	}
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
	/*
			values = []
			point.each( function( index, p ) {
				val = []
				val.push(p["a"])
				p["measurements"].each( function( index, m ) {
					val.push(int(m["i"]))
				} )
				values.push(val)
			} )

			var d = new google.visualization.DataTable();
			d.addColumn('number', 'Angle');
    		d.addColumn('number', 'Intensity');
	    	d.addRows(values);

    		var options = {
        		title: 'Intensity based on angle',
	        	curveType: 'function',
    	    	legend: { position: 'bottom' }
    		};

    		var chart = new google.visualization.CandlestickChart(document.getElementById('chart'))
			chart.draw(d, options)
	*/
}

/*

function visualization() {
	var chosenStartAngle = 0;
	var chosenEndAngle = 0;
	var chosenX = 500;
	var chosenY = 500;
	var chosenSize = 10;
	var pixelsPerImage = 1000000;
	var min = NaN; //Lowest value
	var max = NaN; //Highest value
	var color; //Color interpolator
	var gh = 1000; // height of the image
	var gw = 1000; //width of the image
	
	// Setting up canvas of the image
	d3.select("body")
		.select("#image")
		.attr("width", gw)
		.attr("height", gh)[0];
	image = document.getElementById("image");

	google.charts.load('current', {'packages':['corechart']});
	google.charts.setOnLoadCallback(drawChart);

	$( "#slider-range" ).slider({
    	range: true,
    	min: -20,
    	max: 20,
    	step: 5,
    	values: [ 0, 0 ],
    	slide: function( event, ui ) {
    		chosenStartAngle = ui.values[ 0 ];
    		chosenEndAngle = ui.values[ 1 ];
    		refreshLegend();
    		computeImageData();
    		imageIt();
    	}
	});

	$("#combine-method").change(function() {
		computeImageData();
		imageIt();
	})

	refreshLegend();
	computeImageData();
	imageIt();
	
	$(image).on("click", function(e) {
		lastX = chosenX;
		lastY = chosenY;
		chosenX = Math.round(e.originalEvent.offsetX/this.clientWidth * this.width);
		chosenY = Math.round(e.originalEvent.offsetY/this.clientHeight * this.height);
		refreshLegend();
		redrawRect(lastX - chosenSize/2 - 1, lastY - chosenSize/2 - 1,  chosenSize + 2,  chosenSize + 2);
		drawChart();
	});

	function refreshLegend() {
		$("#from").html(chosenStartAngle);
    	$("#to").html(chosenEndAngle);
    	$("#x").html(chosenX);
    	$("#y").html(chosenY);
	}
	
	function imageIt() {
		redrawRect(0, 0, gw, gh)
	}
	
	

	function drawChart() {
		pixel = 1000 * chosenY +  chosenX;
		var d = new google.visualization.DataTable();
		d.addColumn('number', 'Angle');
      	d.addColumn('number', 'Intensity');
        d.addRows([
          [-20,  data["-20"][pixel]["intensity"]],
          [-15,  data["-15"][pixel]["intensity"]],
          [-10,  data["-10"][pixel]["intensity"]],
          [-5,  data["-5"][pixel]["intensity"]],
          [0,  data["0"][pixel]["intensity"]],
          [5,  data["5"][pixel]["intensity"]],
          [10,  data["10"][pixel]["intensity"]],
          [15,  data["15"][pixel]["intensity"]],
          [20,  data["20"][pixel]["intensity"]]
        ]);

        var options = {
          title: 'Intensity based on angle',
          curveType: 'function',
          legend: { position: 'bottom' }
        };

        var chart = new google.visualization.LineChart(document.getElementById('curve_chart'));

        chart.draw(d, options);
      }

	function computeImageData() {
		len = gw * gh;
		imageData = new Array(len);
		min = data[chosenStartAngle][0]["intensity"];
		max = 0;
		if($("#combine-method").val() == "median") {
			medianCombination();
		} else if($("#combine-method").val() == "min") {
			minCombination();
		} else if($("#combine-method").val() == "max") {
			maxCombination();
		} else {
			averageCombination();
		}
		color = d3.scale.linear()
			.domain([min, max])
			.range(["black", "white"])
		
		for (var i = 0; i < len; i++) {
			imageData[i] = color(imageData[i]);
		}
	}

	function averageCombination() {
		n = (chosenEndAngle - chosenStartAngle) / 5 + 1;
		for (var i = 0; i < len; i++) {
			sum = 0;
			for (var x = 0; x < n; x++) {
				sum += data[chosenStartAngle + x * 5][i]["intensity"];
			}
			imageData[i] = sum / n;
			if(imageData[i] > max) {
				max = imageData[i];
			} 
			if(imageData[i] < min) {
				min = imageData[i];
			}
		}
	}

	function medianCombination() {
		n = (chosenEndAngle - chosenStartAngle) / 5 + 1;
		for (var i = 0; i < len; i++) {
			values = new Array(n);
			for (var x = 0; x < n; x++) {
				values[x] = data[chosenStartAngle + x * 5][i]["intensity"];
			}
			values.sort( function(a,b) {return a - b;} );
			var half = Math.floor(values.length/2);

    		if(values.length % 2)
        		imageData[i] = values[half];
    		else
        		imageData[i] = (values[half-1] + values[half]) / 2.0;
			if(imageData[i] > max) {
				max = imageData[i];
			} 
			if(imageData[i] < min) {
				min = imageData[i];
			}
		}
	}

	function minCombination() {
		n = (chosenEndAngle - chosenStartAngle) / 5 + 1;
		for (var i = 0; i < len; i++) {
			imageData[i] = data[chosenStartAngle][i]["intensity"];
			for (var x = chosenStartAngle + 5; x <= chosenEndAngle; x += 5) {
				if(data[x][i]["intensity"] < imageData[i])
					imageData[i] = data[x][i]["intensity"];
			}
			if(imageData[i] > max) {
				max = imageData[i];
			} 
			if(imageData[i] < min) {
				min = imageData[i];
			}
		}
	}

	function maxCombination() {
		n = (chosenEndAngle - chosenStartAngle) / 5 + 1;
		for (var i = 0; i < len; i++) {
			imageData[i] = data[chosenStartAngle][i]["intensity"];
			for (var x = chosenStartAngle + 5; x <= chosenEndAngle; x += 5) {
				if(data[x][i]["intensity"] < imageData[i])
					imageData[i] = data[x][i]["intensity"];
			}
			if(imageData[i] > max) {
				max = imageData[i];
			} 
			if(imageData[i] < min) {
				min = imageData[i];
			}
		}
	}
}
*/

