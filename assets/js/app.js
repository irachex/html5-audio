var DEFAULT_VISUAL = 0;
var isGLVisual = false;

App = function() {
	var EQ_COUNT = 10;
	var EQ_BAND_COUNT = 10;
	var FRAME_BUFFER_SIZE = 1024;
	var eq = [];
	var selectedEq;
	var channels;
	var sampleRate;
	var sourceBuffer = [];
	var sourceBufferWriteOffset = 0;
	var overlapBufferWriteOffset = 0;
	var targetBuffers = [];
	var fft_re = [];
	var fft_im = [];
	var fft;

	function triangularWindowFunc(x) {
		return 1 - Math.abs(1 - 2 * x);
	}

	function cosineWindowFunc(x) {
		return Math.cos(Math.PI * x - Math.PI / 2);
	}

	function hammingWindowFunc(x) {
		return 0.54 - 0.46 * Math.cos(2 * Math.PI * x);
	}

	function hannWindowFunc(x) {
		return 0.5 * (1 - Math.cos(2 * Math.PI * x));
	}

	function windowFunc(buffer, size, stride, strideOffset) {
		for (var i = 0; i < size; i++) {
			buffer[i * stride + strideOffset] *= hammingWindowFunc(i / (size - 1));
			//buffer[i * stride + strideOffset] *= triangularWindowFunc(i / (size - 1));
			//buffer[i * stride + strideOffset] *= cosineWindowFunc(i / (size - 1));
			//buffer[i * stride + strideOffset] *= hannWindowFunc(i / (size - 1));
		}
	}

	function butterworthFilter(x, n, d0) {
		return 1 / (1 + Math.pow(Math.abs(x) / d0, 2 * n));
	}

	function eqFilter(x) {
		var seq = eq[selectedEq];
		var sum = 1;
		for (var i = 0; i < EQ_BAND_COUNT; i++) {
			sum += seq[EQ_BAND_COUNT - 1 - i] * butterworthFilter(x * (2 << i) - 1, 2, 0.4);
		}
		return sum;
	}

	function process(e) {
	   /* var inputArrayL = event.inputBuffer.getChannelData(0);
        var inputArrayR = event.inputBuffer.getChannelData(1);
        var outputArrayL = event.outputBuffer.getChannelData(0);
        var outputArrayR = event.outputBuffer.getChannelData(1);

        var n = inputArrayL.length;

        for (var i = 0; i < n; ++i) {
            outputArrayL[i] = inputArrayL[i];
            outputArrayR[i] = inputArrayR[i];
        }*/
	    frameBuffer = new Float32Array(frameBufferSize);
	    var n = 0;
	    for (var i = 0; i < channels; ++i) {
	        inputBuffer = e.inputBuffer.getChannelData(i);
	        for (var j = 0; j < bufferSize; ++j) {
	            frameBuffer[n++] = inputBuffer[j];
            }
        }
        
	    sourceBuffer.set(frameBuffer, sourceBufferWriteOffset);
    	
    	var halfFrameBufferSize = frameBufferSize / 2;
    	
		var offset = [];
		offset[0] = sourceBufferWriteOffset - halfFrameBufferSize;
		offset[1] = offset[0] + halfFrameBufferSize;
		offset[2] = offset[1] + halfFrameBufferSize;
		if (offset[0] < 0)
			offset[0] += sourceBuffer.length;

		sourceBufferWriteOffset += frameBufferSize;
		sourceBufferWriteOffset %= frameBufferSize * 2;

		for (var i = 0; i < channels; i++) {
		//	targetBuffers[i].set(sourceBuffer.subarray(offset[i + 0], offset[i + 0] + halfFrameBufferSize), 0);
		//	targetBuffers[i].set(sourceBuffer.subarray(offset[i + 1], offset[i + 1] + halfFrameBufferSize), halfFrameBufferSize);
		    targetBuffers[i].set(e.inputBuffer.getChannelData(i), 0);
		    targetBuffers[i].set(e.inputBuffer.getChannelData(i), halfFrameBufferSize);

			for (var j = 0; j < channels; j++) {
			   // windowFunc(targetBuffers[i], targetBuffers[i].length, channels, j);

				fft.forward(targetBuffers[i], channels, j, fft_re[j], fft_im[j]);

				for (var k = 1; k < fft.size / channels; k++) {
					var f = eqFilter((k - 1) / (fft.size - 1));
					fft_re[j][k] *= f;
					fft_im[j][k] *= f;
					fft_re[j][fft.size - k] *= f;
					fft_im[j][fft.size - k] *= f;
				}
			}

			for (var j = 0; j < channels; j++) {
				fft.inverse(fft_re[j], fft_im[j], targetBuffers[i], channels, j);
			}
		}
		
		/*for (var i = 0; i < channels; i++) {
        	for (var j = 0; j < frameBufferSize / channels; j++) {
        		overlapBuffer[overlapBufferWriteOffset + j] += targetBuffers[i][j];
        	}

        	overlapBufferWriteOffset += frameBufferSize / channels;
        	overlapBufferWriteOffset %= overlapBuffer.length;

        	for (var j = 0; j < frameBufferSize / channels; j++) {
        		overlapBuffer[overlapBufferWriteOffset + j] = targetBuffers[i][frameBufferSize / channels + j];
        	}
        }
        
		var completionOffset = overlapBufferWriteOffset;
        completionBuffer = overlapBuffer.subarray(completionOffset, completionOffset + frameBufferSize);
        */
        for (var i = 0; i < channels; ++i) {
            outputBuffer = e.outputBuffer.getChannelData(i);
		    for (var j = 0; j < outputBuffer.length; ++j) {
		        //outputBuffer[j] = completionBuffer[j * channels + i];
		        outputBuffer[j] = targetBuffers[i][j];
	        }
		}
		
	}
	
	function db_to_mag(db) {
		return Math.pow(10, db / 10);
	}

	function mag_to_db(mag) {
		return 10 * (Math.log(mag) / Math.log(10));
	}

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
    
    function showVisual() {
        //showFrequencyVisual();
       // showWaveformVisual();
        showGLVisual();
    }
    
    function showFrequencyVisual(time) {
        if (isGLVisual) return;
        window.webkitRequestAnimationFrame(showFrequencyVisual, eqCanvas);
        var freqByteData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqByteData);

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
        if (isGLVisual) return;
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
    
    function showGLVisual() {
        if (!isGLVisual) return;
        window.webkitRequestAnimationFrame(showGLVisual, glCanvas);
        analyserView.doFrequencyAnalysis();
    }
    
	function showSpectrumVisual() {
		if (!completionBuffer) {
			return;
		}

		// FFT to completion buffer for spectrum drawing
		for (var i = 0; i < channels; i++) {
			fft.forward(completionBuffer, channels, i, fft_re[i], fft_im[i]);
		}

		eqCanvasCtx.clearRect(0, 0, eqCanvas.width, eqCanvas.height);

		var barWidth = 3;
		var barInterval = 1;
		var scale = 100;

		for (var i = 0; i < fft.size / 2; i += 4) {
			var spectrum = 0;

			for (var j = 0; j < channels; j++) {
				var re = fft_re[j];
				var im = fft_im[j];
				for (var k = 0; k < 4; k++) {
					spectrum += Math.sqrt(re[i + k] * re[i + k] + im[i + k] * im[i + k]);
				}
				spectrum /= 4;
			}

			spectrum /= channels;
			spectrum *= scale;
			magnitude = spectrum * 256;

			var rgb = hsvToRgb(i / (fft.size / 2), 1, 1);

			eqCanvasCtx.fillStyle = "rgb(" + rgb.join(",") + ")";
			eqCanvasCtx.fillRect((barWidth + barInterval) * i/4, eqCanvas.height, barWidth, -magnitude);
		}
	}
	
	function switchVisual(visualType) {
	    switch (visualType) {
	        case DEFAULT_VISUAL:
	            if (isGLVisual) {
	                $("#gl-canvas").hide();
	                $("#eq-canvas").show();
	                $("#waveform-canvas").show();
	                isGLVisual = false;
	                analyser.smoothingTimeConstant = 0.9;
	                showFrequencyVisual();
                }
	            break;
	        default:
	            if (!isGLVisual) {
	                $("#gl-canvas").show();
	                $("#eq-canvas").hide();
	                $("#waveform-canvas").hide();
                    isGLVisual = true;
                    showGLVisual();
                }
	            analyserView.setAnalysisType(visualType);
	            break;
        }
    }
	
	function initVisual() {
	    $("#gl-canvas").hide();
	    glCanvas = document.getElementById('gl-canvas');
	    glCanvas.width = document.body.clientWidth / 1.4;
	    analyserView = new AnalyserView("gl-canvas");
	    analyserView.initByteBuffer();
        
        eqCanvas = document.getElementById('eq-canvas');
        eqCanvas.width = document.body.clientWidth;
        eqCanvasCtx = eqCanvas.getContext('2d');
        
        waveformCanvas = document.getElementById('waveform-canvas');
        waveformCanvas.width = document.body.clientWidth;
        waveformCanvasCtx = waveformCanvas.getContext('2d');

        CANVAS_HEIGHT = eqCanvas.height;
        CANVAS_WIDTH = eqCanvas.width;
        
        //showVisual();
        showFrequencyVisual();
        //setInterval(showSpectrumVisual, 1000 / 14);
        setInterval(showWaveformVisual, 1000 / 14);
        //showGLVisual();
        
        $("#visual-section li").click(function() {
            $("#visual-section li").removeClass("active");
            $(this).addClass("active");
        });
        
        $("#default-visual").click(function() {
            switchVisual(DEFAULT_VISUAL);
        });
        $("#frequency-visual").click(function() {
            switchVisual(ANALYSISTYPE_FREQUENCY);
        });
        $("#sonogram-visual").click(function() {
            switchVisual(ANALYSISTYPE_SONOGRAM);
        });
        $("#3d-sonogram-visual").click(function() {
            switchVisual(ANALYSISTYPE_3D_SONOGRAM);
        });
    }
    
	function turnOnEq() {
	    volume.disconnect();
	    processor.disconnect();
        analyser.disconnect();
        
	    volume.connect(processor);
        processor.connect(analyser);
        analyser.connect(audioCtx.destination);
    }
    
    function turnOffEq() {
        processor.disconnect();
        analyser.disconnect();
        
        volume.connect(analyser);
        analyser.connect(audioCtx.destination);
    }
    
	function initEq() {
	    eq[0] = [ 0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00]; // 
		eq[1] = [ 0.30,  0.30,  0.20,  0.05,  0.10,  0.10,  0.20,  0.25,  0.20,  0.10]; //
		eq[2] = [ 1.90,  1.80,  1.70,  1.35,  1.10,  0.50,  0.20,  0.25,  0.20,  0.10]; //
		eq[3] = [ 0.40,  0.30,  0.20,  0.00,  0.50,  0.30,  0.10,  0.20,  0.60,  0.70]; //
		eq[4] = [ 0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00]; //
		eq[5] = [ 0.40,  0.30,  0.00,  0.30,  0.40,  0.20,  0.40,  0.50,  0.40,  0.50]; //
		eq[6] = [ 0.40,  0.20,  0.00,  0.40,  1.00,  1.00,  0.40,  0.00, -0.20, -0.40]; //
		eq[7] = [ 0.75,  0.65,  0.60,  0.50,  0.15,  0.25,  0.00,  0.25,  0.40,  0.54]; //
		eq[8] = [-1.00, -1.00, -1.00, -1.00,  0.00,  0.10,  0.20,  0.30,  0.10, -0.10]; //
		eq[9] = [ 0.20,  0.80,  0.80,  0.40,  0.80,  0.80,  0.40,  0.20,  0.00, -0.40]; //

		selectedEq = 0;

		for (var i = 0; i < EQ_BAND_COUNT; i++) {
			var createSlider = function(index) {
				$("#slider" + index).slider({
					min: -1.0, max: 2.0, step: 0.05, value: eq[0][index],
					orientation: 'vertical',
					slide: function(event, ui) { 
						selectedEq = 0;
						eq[0][index] = ui.value;
						$("#combobox-equalizer").val({value: 0});
					}
				});
			}(i);
		}

		$("#combobox-equalizer").val({value: 0}).change(function() { 
			for (var i = 0; i < EQ_COUNT; i++) {
				selectedEq = this.value;
				$("#slider" + i).slider({value: eq[selectedEq][i]});
			}
		});
				
		$("#eq-on").click(function() {
		    $(".eq-turn").removeClass("active");
		    $(this).addClass("active");
		    turnOnEq();
	    });
	    
	    $("#eq-off").click(function() {
	        $(".eq-turn").removeClass("active");
		    $(this).addClass("active");
	        turnOffEq();
        });
    }
    
    function loadAudio(url, callback) {
        $("#loading").show();
        // Load asynchronously
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = function() { 
            audioCtx.decodeAudioData(request.response, function(buffer) {
                $("#loading").fadeOut(300);
                source.buffer = buffer;
                source.loop = true;
                source.noteOn(0);
                if (callback) callback();
            });
        };
        request.send();
    }
    
    function play() {
        source.connect(volume);
        $("#play").removeClass("play").addClass("pause");
    }
    
    function pause() {
        source.disconnect();
        $("#play").removeClass("pause").addClass("play");
    }
    
    function initAudio() {
        audioCtx = new webkitAudioContext();
        analyser = audioCtx.createAnalyser();
                
        sampleRate = audioCtx.sampleRate;
        channels = audioCtx.destination.numberOfChannels;
        frameBufferSize = FRAME_BUFFER_SIZE;
        
        sourceBuffer = new Float32Array(frameBufferSize * channels + sourceBufferWriteOffset);
        overlapBuffer = new Float32Array(frameBufferSize * channels);
        for (var i = 0; i < channels; i++) {
            targetBuffers[i] = new Float32Array(frameBufferSize);
        }
        
        bufferSize = frameBufferSize / channels;
        fft = new FFT(bufferSize);

        for (var i = 0; i < channels; i++) {
        	fft_re[i] = new Float32Array(bufferSize);
        	fft_im[i] = new Float32Array(bufferSize);
        }
        
        source = audioCtx.createBufferSource();
        volume = audioCtx.createGainNode();
        volume.gain.value = 0.5;
        processor = audioCtx.createJavaScriptNode(bufferSize, 1, 1);
        processor.onaudioprocess = process;
        
        source.connect(volume);
       // volume.connect(analyser);
        volume.connect(processor);
        processor.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        loadAudio("audio/2.mp3");
        
        $("#play").click(function() {
            if ($(this).hasClass("play")) {
                play();
            } else {
                pause();
            }
            });
        $(".song").click(function() {
            $(".song").removeClass("active");
            $(this).addClass("active");
            pause();
            loadAudio($(this).attr("audio"), function() {
                play();
            });
        });
    }
    
    function init() {
        initAudio();
        initEq();
        initVisual();
        pause();
    }
    
    return { init: init };
}();