import { GESTURE_CONFIG } from '../config/gestures.js';

const numberEntries = (object) => Object.entries(object).filter(([, value]) => typeof value === 'number');

export class DebugPanel {
  constructor({ panel, values, sliders, copyButton, recordButton, onConfigChange }) {
    this.panel = panel;
    this.values = values;
    this.sliders = sliders;
    this.onConfigChange = onConfigChange;
    this.frames = [];
    copyButton.addEventListener('click', () => this.copy());
    recordButton.addEventListener('click', () => this.download());
  }

  show(visible) {
    this.panel.hidden = !visible;
  }

  setVerb(verb, config) {
    this.verb = verb;
    this.config = config;
    this.sliders.replaceChildren();
    for (const [key, value] of numberEntries(config)) {
      const row = document.createElement('label');
      row.textContent = `${key} `;
      const output = document.createElement('output');
      output.value = String(value);
      const input = document.createElement('input');
      input.type = 'range';
      const span = Math.max(1, Math.abs(value) * 1.5);
      input.min = String(value === 0 ? 0 : value - span);
      input.max = String(value === 0 ? 2 : value + span);
      input.step = String(Math.max(0.001, Math.abs(value) / 100 || 0.01));
      input.value = String(value);
      input.addEventListener('input', () => {
        config[key] = Number(input.value);
        output.value = Number(input.value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
        this.onConfigChange?.(config);
      });
      row.append(input, output);
      this.sliders.append(row);
    }
  }

  addFrame(frame) {
    if (!frame) return;
    this.frames.push(frame);
    const cutoff = frame.t - 10000;
    while (this.frames[0]?.t < cutoff) this.frames.shift();
  }

  update(data) {
    this.values.textContent = JSON.stringify(data, null, 2);
  }

  async copy() {
    const json = JSON.stringify({ [this.verb]: this.config }, null, 2);
    try { await navigator.clipboard.writeText(json); } catch { /* clipboard may be unavailable */ }
  }

  download() {
    const blob = new Blob([JSON.stringify(this.frames, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pose-${this.verb || 'recording'}-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }
}

export function mutableGestureConfig(verb) {
  return { ...GESTURE_CONFIG[verb] };
}
