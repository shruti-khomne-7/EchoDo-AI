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
    this.canvas = document.getElementById('waveform-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.animFrameId = null;
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

        this.onResult(transcript, isFinal);
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        this.onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onEnd();
      };
    } else {
      console.warn('Web Speech API is not supported in this browser. Fallback mode enabled.');
    }
  }

  startListening() {
    if (this.isListening) return;

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        this.onStart();
      }
    } else {
      // Browser fallback simulation if no mic permission or API support
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
        console.warn('Error stopping recognition:', err);
      }
    }
    this.onEnd();
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  // Canvas Audio Wave Visualizer
  initVisualizer() {
    if (!this.ctx || !this.canvas) return;

    const draw = () => {
      this.animFrameId = requestAnimationFrame(draw);
      const width = this.canvas.width;
      const height = this.canvas.height;
      const centerY = height / 2;

      this.ctx.clearRect(0, 0, width, height);
      this.audioPhase += 0.05;

      this.ctx.beginPath();
      this.ctx.lineWidth = 2.5;

      if (this.isListening) {
        // Dynamic active waveform
        const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(0.5, '#06b6d4');
        gradient.addColorStop(1, '#8b5cf6');
        this.ctx.strokeStyle = gradient;

        for (let x = 0; x < width; x++) {
          const amp = Math.sin(x * 0.02 + this.audioPhase) * 18 + Math.cos(x * 0.05 - this.audioPhase * 1.5) * 8;
          const y = centerY + amp;
          if (x === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
      } else {
        // Ambient breathing line
        this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
        for (let x = 0; x < width; x++) {
          const amp = Math.sin(x * 0.01 + this.audioPhase * 0.5) * 3;
          const y = centerY + amp;
          if (x === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
      }

      this.ctx.stroke();
    };

    draw();
  }

  // Text-To-Speech Synthesis
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // stop previous speaking
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    window.speechSynthesis.speak(utterance);
  }
}

window.VoiceEngine = VoiceEngine;
