export class GameAudio {
  constructor() {
    this.enabled = true;
    this.context = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  speak(text) {
    if (!this.enabled || !('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  tone({ frequency = 440, duration = 0.12, volume = 0.08, delay = 0 } = {}) {
    if (!this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      this.context ??= new AudioContext();
      const start = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Audio is optional and can be blocked until a user gesture.
    }
  }

  success() {
    [523, 659, 784].forEach((frequency, index) => this.tone({ frequency, duration: 0.22, delay: index * 0.11 }));
  }

  wrong() {
    this.tone({ frequency: 220, duration: 0.16, volume: 0.045 });
  }

  close() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.context?.close?.();
    this.context = null;
  }
}
