// src/utils/soundEffects.js
class SoundEffectEngine {
  constructor() {
    this.audioCtx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.intervalId = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
  }

  // Play standard telecommunication ringing cadence (UK/US dual-tone style)
  playRingbackTone() {
    try {
      this.init();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.intervalId) return;

      const playTone = () => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // 440Hz + 480Hz classic ringtone harmonics
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 2.0);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 2.0);
      };

      playTone();
      this.intervalId = setInterval(playTone, 4000); // Repeat every 4 seconds
    } catch (err) {
      console.warn("Audio context playback restricted:", err);
    }
  }

  stopRingtone() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }
}

export const soundEffects = new SoundEffectEngine();