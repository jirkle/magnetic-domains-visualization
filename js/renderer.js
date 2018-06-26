var renderTimerId
var renderGraphId
var rerenderRegions = []
var rerenderGraph = undefined
var rerenderInterval = 10

// ##########
// Interface:
// ##########
// Redraws whole image with set imageData
function redrawImage() {
	imageData = getData()
	if ( imageData ) {
		appendImageRegionToRender( {"x1": 0, "y1": 0, "x2": imageData["width"] - 1, "y2": imageData["height"] - 1, "function": redrawImageRect})
	}
}

// Redraws whole overlay image
function redrawOverlay() {
	imageData = getData()
	if ( imageData ) {
		redrawOverlayRect( 0, 0, imageData["width"] - 1, imageData["height"] - 1)
	}
}

// Redraws histogram
function redrawHistogram() {
	imageData = getData()
	if ( imageData ) {
		rerenderGraph = {"x1": selectedSquare["x1"], "y1": selectedSquare["y1"], "x2": selectedSquare["x2"], "y2": selectedSquare["y2"], "function": drawHistogram}
		if ( renderGraphId ) {
			clearInterval(renderGraphId);
			renderGraphId = setInterval( renderGraph, rerenderInterval )
		} else {
			renderGraphId = setInterval( renderGraph, rerenderInterval )
		}
	}
}

// Redraws intensity chart
function redrawIntensityChart() {
	imageData = getData()
	if ( imageData ) {
		rerenderGraph = {"x1": selectedPoint["x1"], "y1": selectedPoint["y1"], "x2": 0, "y2": 0, "function": drawIntensityChart}
		if ( renderGraphId ) {
			clearInterval(renderGraphId);
			renderGraphId = setInterval( renderGraph, rerenderInterval )
		} else {			
			renderGraphId = setInterval( renderGraph, rerenderInterval )
		}		
	}
}

// Appends region which should be rerendered in image layer to list of dirty regions and starts the renderer if necessary
function appendImageRegionToRender(region) {
	if(region["x2"] - region["x1"] > 100 || region["y2"] - region["y1"] > 100) {
		width = region["x2"] - region["x1"]
		height = region["y2"] - region["y1"]
		widthSegments = width / 100
		heightSegments = height / 100
		for(x = 0; x < widthSegments; x++) {
			for(y = 0; y < heightSegments; y++) {
				copy = jQuery.extend({}, region)
				copy["x1"] = x * 100
				copy["x2"] = Math.min((x + 1) * 100, width)
				copy["y1"] = y * 100
				copy["y2"] = Math.min((y + 1) * 100, height)
				rerenderRegions.push(copy)
			}
		}
		shuffle(rerenderRegions)
	}
	if ( !renderTimerId ) {
		renderTimerId = setInterval( render, rerenderInterval )
	}
}

// Appends region which should be rerendered in overlay layer to list of dirty regions and starts the renderer if necessary
function appendRenderJob(region) {
	rerenderRegions.push(region)
	if ( !renderTimerId ) {
		renderTimerId = setInterval( render, rerenderInterval )
	}
}

// #########
// Internal:
// #########

function render() {
	if ( rerenderRegions.length > 0 ) {
		region = rerenderRegions.pop()
		region["function"](region["x1"], region["y1"], region["x2"], region["y2"])
	} else {
		clearInterval(renderTimerId)
		renderTimerId = undefined
		hideLoader()
	}	
}

function renderGraph() {
	if( rerenderGraph ) {
		graph = rerenderGraph
		rerenderGraph = undefined
		graph["function"](graph["x1"], graph["y1"], graph["x2"], graph["y2"])
		clearInterval(renderGraphId)
	}
}

function redrawImageRect(x1, y1, x2, y2) {
	var imageContext = image.getContext("2d");
	imageContext.fillStyle = "#000000";
	imageContext.clearRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1)
	for (var localY = y1; localY <= y2; localY++) {
		for (var localX = x1; localX <= x2; localX++) {
			intensity = imageData["rows"][localY][localX]
			color = imageData["color"](intensity);
			imageContext.fillStyle = color;
			imageContext.fillRect(localX, localY, 1, 1);
		}
	}
}

function redrawOverlayRect(x1, y1, x2, y2) {
	var imageContext = overlay.getContext("2d");
	imageContext.fillStyle = "#ffffffff";
	imageContext.clearRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1)
	if ( pointMode ) {
		// Draw image
		chosenX = selectedPoint["x1"]
		chosenY = selectedPoint["y1"]

		intensity = imageData["rows"][chosenY][chosenX]
		color = imageData["color"](intensity);
		//Draw selection
		//Red border
		drawRect(chosenX - chosenSize/2 - borderSize, chosenY - chosenSize/2 - borderSize, chosenSize + 2 * borderSize, chosenSize + 2 * borderSize, "red", imageContext)
		//Color
		drawRect(chosenX - chosenSize/2, chosenY - chosenSize/2, chosenSize, chosenSize, color, imageContext)
	} else {
		//Region mode
		//Shading
		drawRect(x1, y1, selectedSquare["x1"] - x1, selectedSquare["y1"] - y1, shadeColor, imageContext) //Region 1
		drawRect(selectedSquare["x1"], y1, selectedSquare["x2"] - selectedSquare["x1"], selectedSquare["y1"] - y1, shadeColor, imageContext) //Region 2
		drawRect(selectedSquare["x2"], y1, x2 - selectedSquare["x2"] + 1, selectedSquare["y1"] - y1, shadeColor, imageContext) //Region 3
		drawRect(selectedSquare["x2"], selectedSquare["y1"], x2 - selectedSquare["x2"] + 1, selectedSquare["y2"] - selectedSquare["y1"], shadeColor, imageContext) //Region 4
		drawRect(selectedSquare["x2"], selectedSquare["y2"], x2 - selectedSquare["x2"] + 1, y2 - selectedSquare["y2"], shadeColor, imageContext) //Region 5
		drawRect(selectedSquare["x1"], selectedSquare["y2"], selectedSquare["x2"] - selectedSquare["x1"], y2 - selectedSquare["y2"], shadeColor, imageContext) //Region 6
		drawRect(x1, selectedSquare["y2"], selectedSquare["x1"] - x1, y2 - selectedSquare["y2"], shadeColor, imageContext) //Region 7
		drawRect(x1, selectedSquare["y1"], selectedSquare["x1"] - x1, selectedSquare["y2"] - selectedSquare["y1"], shadeColor, imageContext) //Region 8
	}
}

function drawRect(x, y, width, height, color, imageContext) {
	if ( width > 0 || height > 0) {
		imageContext.fillStyle = color;
		imageContext.fillRect(x, y, width, height);
	}
}

function drawIntensityChart(x1, y1, x2, y2) {
	$.ajax( {
		url: "http://" + server_address + ":" + server_port + "/point?x1=" + x1 + "&y1=" + y1,
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
        		title: 'Boxplot for intensities based on measuring angle:',
        		titleTextStyle: {color: '#FFF'},
    	    	legend: 'none',
    	    	backgroundColor: { fill: "#3e4147" },
    	    	colors: ['#e0440e'],
    	    	hAxis: {
    	    		textStyle:{color: '#FFF'},
		    		baseline: angle,
    				gridlines: {
      		  			color: "#555"
    				},
	    			baselineColor: '#ffffff'
    			},
		    	vAxis: {
		    		textStyle:{color: '#FFF'},
		    		maxValue: 20000,
    				gridlines: {
        				color: "#555"
		    		},
    				baselineColor: '#ffffff'
		    	}
    		};

    		var chart = new google.visualization.CandlestickChart(document.getElementById('chart'))
			chart.draw(d, options)
		}
	} )
}

function drawHistogram(x1, y1, x2, y2) {
	$('#chart').empty()
	values = [['Intensity']]
	d = imageData["rows"]
	for (var x = x1; x <= x2; x++) {
		for (var y = y1; y <= y2; y++) {
			values.push([parseInt(d[y][x])])
		}
	}

	var d = google.visualization.arrayToDataTable(values);
	var options = {
        title: 'Intensities histogram:',
        titleTextStyle: {color: '#FFF'},
    	legend: {
    		textStyle:{color: '#FFF'},
    		position: 'bottom'
    	},
    	backgroundColor: { fill: "#3e4147" },
    	colors: ['#e0440e'],
    	hAxis: {
    		textStyle:{color: '#FFF'},
    		gridlines: {
        		color: "#555"
    		},
    		baselineColor: '#FFF'
    	},
    	vAxis: {
    		textStyle:{color: '#FFF'},
    		gridlines: {
        		color: "#555"
    		},
    		baselineColor: '#FFF'
    	},
    	histogram: {
    		minValue: imageData["min"],
      		maxValue: imageData["max"]
      	}
    };

	var chart = new google.visualization.Histogram(document.getElementById('chart'));
    chart.draw(d, options);
}

function shuffle(array) {
    let counter = array.length;

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        let index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}