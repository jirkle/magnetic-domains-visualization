var data = {};
var imageData;

d3.csv("data/-20000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["-20"] = d
});
d3.csv("data/-15000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["-15"] = d
});
d3.csv("data/-10000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["-10"] = d
});
d3.csv("data/-5000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["-5"] = d
});
d3.csv("data/0_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["0"] = d
		visualization()
});
d3.csv("data/5000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["5"] = d
});
d3.csv("data/10000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["10"] = d
});
d3.csv("data/15000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["15"] = d
});
d3.csv("data/20000_0.pgm.csv", function(d) {
		return { "intensity": +d["intensity"]	};
	}, function(d) {
		data["20"] = d
});

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

	/*
	$(image).on('click', function () {
		t = parseInt(d3.mouse(this)[0]/ratio);
		line();
		colorStates();
		changeLegend();
	});
	
	image.on("scroll", function(){
		alert("The paraimage was clicked.");
	}); */

	function refreshLegend() {
		$("#from").html(chosenStartAngle);
    	$("#to").html(chosenEndAngle);
    	$("#x").html(chosenX);
    	$("#y").html(chosenY);
	}
	
	function imageIt() {
		redrawRect(0, 0, gw, gh)
	}
	
	function redrawRect(x, y, width, height) {
		var imageContext = image.getContext("2d");
		imageContext.fillStyle = "#000000";
		imageContext.fillRect(x, y, width, height);
		// Draw image
		for (var localY = y; localY <= y + height; localY++) {
			tmp = 1000 * localY;
			for (var localX = x; localX < x + width; localX++) {
				imageContext.fillStyle = imageData[tmp + localX];
				imageContext.fillRect(localX, localY, 1, 1);
			}
		}
		//Draw selection
		imageContext.fillStyle = "red";
		imageContext.fillRect(chosenX - chosenSize/2 - 1, chosenY - chosenSize/2 - 1, chosenSize + 2, chosenSize + 2);
		imageContext.fillStyle = imageData[chosenY * 1000 + chosenX];
		imageContext.fillRect(chosenX - chosenSize/2, chosenY - chosenSize/2, chosenSize, chosenSize);
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

