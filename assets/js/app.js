App = function() {
	var EQ_COUNT = 10;
	var EQ_BAND_COUNT = 10;
	var FRAME_BUFFER_SIZE = 512;
	var eq = [];
	var selectedEq;
	var channels;
	var sampleRate;
	var sourceBuffer = [];
	var sourceBufferWriteOffset = 0;
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
			targetBuffers[i].set(sourceBuffer.subarray(offset[i + 0], offset[i + 0] + halfFrameBufferSize), 0);
			targetBuffers[i].set(sourceBuffer.subarray(offset[i + 1], offset[i + 1] + halfFrameBufferSize), halfFrameBufferSize);

			for (var j = 0; j < channels; j++) {
				windowFunc(targetBuffers[i], targetBuffers[i].length / channels, channels, j);

				fft.forward(targetBuffers[i], channels, j, fft_re[j], fft_im[j]);

				for (var k = 1; k < fft.size / 2; k++) {
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
			
			outputBuffer = e.outputBuffer.getChannelData(i);
			for (var j = 0; j < outputBuffer.length; ++j) {
			    outputBuffer[j] = targetBuffers[i][j];
		    }
		}
	}

	function drawSpectrum() {
		if (!completion_buffer) {
			return;
		}

		// FFT to completion buffer for spectrum drawing
		for (var i = 0; i < channels; i++) {
			fft.forward(completion_buffer, channels, i, fft_re[i], fft_im[i]);
		}
		
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		var bar_width = 3;
		var bar_interval = 1;
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

			ctx.fillStyle = "rgb(" + rgb.join(",") + ")";
			ctx.fillRect((bar_width + bar_interval) * i/4, canvas.height, bar_width, -magnitude);
		}
	}
	
	function db_to_mag(db) {
		return Math.pow(10, db / 10);
	}

	function mag_to_db(mag) {
		return 10 * (Math.log(mag) / Math.log(10));
	}
	
	function initEq() {
	    eq[0] = [ 0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00];
		eq[1] = [ 0.30,  0.30,  0.20,  0.05,  0.10,  0.10,  0.20,  0.25,  0.20,  0.10];
		eq[2] = [ 1.90,  1.80,  1.70,  1.35,  1.10,  0.50,  0.20,  0.25,  0.20,  0.10];
		eq[3] = [ 0.40,  0.30,  0.20,  0.00,  0.50,  0.30,  0.10,  0.20,  0.60,  0.70];
		eq[4] = [ 0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00];
		eq[5] = [ 0.40,  0.30,  0.00,  0.30,  0.40,  0.20,  0.40,  0.50,  0.40,  0.50];
		eq[6] = [ 0.40,  0.20,  0.00,  0.40,  1.00,  1.00,  0.40,  0.00, -0.20, -0.40];
		eq[7] = [ 0.75,  0.65,  0.60,  0.50,  0.15,  0.25,  0.00,  0.25,  0.40,  0.54];
		eq[8] = [-1.00, -1.00, -1.00, -1.00,  0.00,  0.10,  0.20,  0.30,  0.10, -0.10];
		eq[9] = [ 0.20,  0.80,  0.80,  0.40,  0.80,  0.80,  0.40,  0.20,  0.00, -0.40];

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
    }
    
    function initVisual() {
        eqCanvas = document.getElementById('eq-canvas');
        eqCanvasCtx = eqCanvas.getContext('2d');
        eqCanvas.width = document.body.clientWidth;
        
        waveformCanvas = document.getElementById('waveform-canvas');
        waveformCanvasCtx = waveformCanvas.getContext('2d');
        waveformCanvas.width = document.body.clientWidth;

        CANVAS_HEIGHT = eqCanvas.height;
        CANVAS_WIDTH = eqCanvas.width;
        
        showFrequencyVisual();
        setInterval(showWaveformVisual, 1000 / 14);
    }
    
    function initAudio() {
        sampleRate = audioCtx.sampleRate;
        channels = audioCtx.destination.numberOfChannels;
        frameBufferSize = FRAME_BUFFER_SIZE;
        
        sourceBuffer = new Float32Array(frameBufferSize * channels);
        sourceBufferWriteOffset = 0;
        
        for (var i = 0; i < channels; i++) {
            targetBuffers[i] = new Float32Array(frameBufferSize);
        }
        
        bufferSize = frameBufferSize / channels;
        fft = new FFT(bufferSize);

        for (var i = 0; i < channels; i++) {
        	fft_re[i] = new Float32Array(bufferSize);
        	fft_im[i] = new Float32Array(bufferSize);
        }
        
        var source = audioCtx.createMediaElementSource(audio);
        var processor = audioCtx.createJavaScriptNode(bufferSize, 1, 1);
        processor.onaudioprocess = function(e) { process(e) };
        source.connect(processor);
        source.connect(analyser);
        processor.connect(audioCtx.destination);
        analyser.connect(audioCtx.destination);
    }
    function init() {
        initAudio();
        initEq();
        initVisual();
    }
    
    return { init: init };
}();