function hsvToRgb(h, s, v) {
	var r, g, b;

	var i = Math.floor(h * 6);
	var f = h * 6 - i;
	var p = v * (1 - s);
	var q = v * (1 - f * s);
	var t = v * (1 - (1 - f) * s);

	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}

	return [parseInt(r * 255), parseInt(g * 255), parseInt(b * 255)];
}
	
function showFrequencyVisual(time) {
  window.webkitRequestAnimationFrame(showFrequencyVisual, eqCanvas);  

  var freqByteData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqByteData); //analyser.getByteTimeDomainData(freqByteData);
  
  var SPACER_WIDTH = 15;
  var BAR_WIDTH = 10;
  var OFFSET = 0;
  var CUTOFF = 23;
  var numBars = Math.round(CANVAS_WIDTH / SPACER_WIDTH);

  eqCanvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  eqCanvasCtx.lineCap = 'round';
  eqCanvasCtx.fillStyle = "#3A5E8C";
  
  for (var i = 0; i < numBars; ++i) {
	var magnitude = freqByteData[i + OFFSET];
    eqCanvasCtx.fillRect(i * SPACER_WIDTH, CANVAS_HEIGHT, BAR_WIDTH, -magnitude);  
  }
}

function showWaveformVisual(time) {
  var timeDomainData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(timeDomainData);
  
  var RADIUS = 5;
  var SPACER_WIDTH = 10;
  var OFFSET = 0;
  var numBars = Math.round(CANVAS_WIDTH / SPACER_WIDTH);

  waveformCanvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  waveformCanvasCtx.lineCap = 'round';
  
  for (var i = 0; i < numBars; ++i) {
    var rgb = hsvToRgb(i / (numBars / 2), 1, 1);
    var magnitude = timeDomainData[i + OFFSET];
    waveformCanvasCtx.fillStyle = "rgb(" + rgb.join(",") + ")";
    waveformCanvasCtx.beginPath();
    waveformCanvasCtx.arc(i * SPACER_WIDTH, magnitude, RADIUS, 0 , 2 * Math.PI, false);
    waveformCanvasCtx.closePath();
    waveformCanvasCtx.fill();
  }
}
