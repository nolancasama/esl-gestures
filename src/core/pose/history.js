import { HISTORY } from '../../config/timing.js';

const finite = (value) => Number.isFinite(value);

/**
 * Time-bounded pose storage. The advancing head makes pruning O(1) amortized
 * while retaining array iteration order for recognizers.
 */
export class PoseHistory {
  constructor(windowMs = HISTORY.windowMs) {
    const requestedWindow = typeof windowMs === 'object' ? windowMs.windowMs : windowMs;
    this.windowMs = finite(requestedWindow) && requestedWindow >= 0
      ? requestedWindow
      : HISTORY.windowMs;
    this.clear();
  }

  push(np) {
    if (!np || !finite(np.t)) return np;

    const previous = this.latest();
    if (previous && np.t < previous.t) this.clear();

    this._poses.push(np);
    const baseline = this._baselineEntry(np);
    if (baseline) this._baseline.push(baseline);
    this._prune(np.t - this.windowMs);
    return np;
  }

  window(ms = this.windowMs) {
    const latest = this.latest();
    if (!latest) return [];
    const duration = finite(ms) && ms >= 0 ? ms : this.windowMs;
    const cutoff = latest.t - Math.min(duration, this.windowMs);
    const result = [];
    for (let index = this._poseHead; index < this._poses.length; index += 1) {
      if (this._poses[index].t >= cutoff) result.push(this._poses[index]);
    }
    return result;
  }

  latest() {
    return this._poses.length > this._poseHead
      ? this._poses[this._poses.length - 1]
      : null;
  }

  clear() {
    this._poses = [];
    this._poseHead = 0;
    this._baseline = [];
    this._baselineHead = 0;
  }

  /** Shoulder-mid y samples in absolute (0..1 image) coordinates. */
  absoluteWindow(ms = this.windowMs) {
    const latest = this.latest();
    if (!latest) return [];
    const duration = finite(ms) && ms >= 0 ? ms : this.windowMs;
    const cutoff = latest.t - Math.min(duration, this.windowMs);
    const result = [];
    for (let index = this._baselineHead; index < this._baseline.length; index += 1) {
      if (this._baseline[index].t >= cutoff) result.push(this._baseline[index]);
    }
    return result;
  }

  get absoluteBaseline() {
    return this._baseline.slice(this._baselineHead);
  }

  _baselineEntry(np) {
    if (!finite(np.origin?.y)) return null;
    const leftVisibility = finite(np.p?.lShoulder?.v) ? np.p.lShoulder.v : 0;
    const rightVisibility = finite(np.p?.rShoulder?.v) ? np.p.rShoulder.v : 0;
    return {
      t: np.t,
      y: np.origin.y,
      v: Math.min(leftVisibility, rightVisibility)
    };
  }

  _prune(cutoff) {
    while (this._poseHead < this._poses.length && this._poses[this._poseHead].t < cutoff) {
      this._poseHead += 1;
    }
    while (
      this._baselineHead < this._baseline.length
      && this._baseline[this._baselineHead].t < cutoff
    ) {
      this._baselineHead += 1;
    }

    // Periodically reclaim skipped slots without shifting on every frame.
    if (this._poseHead > 128 && this._poseHead * 2 > this._poses.length) {
      this._poses = this._poses.slice(this._poseHead);
      this._poseHead = 0;
    }
    if (this._baselineHead > 128 && this._baselineHead * 2 > this._baseline.length) {
      this._baseline = this._baseline.slice(this._baselineHead);
      this._baselineHead = 0;
    }
  }
}
