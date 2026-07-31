/**
 * Voice Engine for EchoDo AI
 * Handles Web Speech API recognition, Web Audio API visualization, and Text-to-Speech synthesis.
 */

class VoiceEngine {
  constructor(options = {}) {
    this.onResult = options.onResult || (() => {});
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.onError = options.onError || (() => {});

    this.isListening = false;
    this.recognition = null;
    this.lastTranscript = '';
    this.canvas = document.getElementById('waveform-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.audioPhase = 0;

    this.initSpeechRecognition();
    this.initVisualizer();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.lastTranscript = '';
        this.onStart();
      };

      this.recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        if (transcript.trim()) {
          this.lastTranscript = transcript;
          this.onResult(transcript, isFinal);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition notice:', event.error);
        this.isListening = false;
        this.onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onEnd(this.lastTranscript);
      };
    } else {
      console.warn('Web Speech API not natively supported in this browser. Fallback text dictation mode active.');
    }
  }

  startListening() {
    if (this.isListening) return;

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('Recognition start caught error:', err);
        this.isListening = true;
        this.onStart();
      }
    } else {
      this.isListening = true;
      this.onStart();
    }
  }

  stopListening() {
    if (!this.isListening) return;
    this.isListening = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Recognition stop error:', err);
      }
    }
    this.onEnd(this.lastTranscript);
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  initVisualizer() {
    if (!this.ctx || !this.canvas) return;

    const draw = () => {
      requestAnimationFrame(draw);
      const width = this.canvas.width;
      const height = this.canvas.height;
      const centerY = height / 2;

      this.ctx.clearRect(0, 0, width, height);
      this.audioPhase += 0.06;

      this.ctx.beginPath();
      this.ctx.lineWidth = 2.2;

      const isDarkMode = document.body.hasAttribute('data-theme');

      if (this.isListening) {
        this.ctx.strokeStyle = '#2383e2';
        for (let x = 0; x < width; x++) {
          const amp = Math.sin(x * 0.03 + this.audioPhase) * 14 + Math.cos(x * 0.06 - this.audioPhase * 1.4) * 6;
          const y = centerY + amp;
          if (x === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
      } else {
        this.ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(55, 53, 47, 0.15)';
        for (let x = 0; x < width; x++) {
          const amp = Math.sin(x * 0.015 + this.audioPhase * 0.4) * 2.5;
          const y = centerY + amp;
          if (x === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
      }

      this.ctx.stroke();
    };

    draw();
  }

  speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

window.VoiceEngine = VoiceEngine;
