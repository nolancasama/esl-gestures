import { TIMING } from '../../config/timing.js';
import { poseAt } from '../../core/synth/generate.js';

const defaultNow = () => globalThis.performance?.now?.() ?? Date.now();
const defaultRequestFrame = (callback) => globalThis.requestAnimationFrame
  ? globalThis.requestAnimationFrame(callback)
  : globalThis.setTimeout(() => callback(defaultNow()), 16);
const defaultCancelFrame = (handle) => globalThis.cancelAnimationFrame
  ? globalThis.cancelAnimationFrame(handle)
  : globalThis.clearTimeout(handle);

/**
 * Synthetic PoseFrame source with the same lifecycle as PoseDetector.
 * Emitted timestamps remain monotonic; only the motion clock resets when an
 * item target changes.
 */
export class SimulatedDetector {
  constructor({
    onFrame = () => {},
    onInference = () => {},
    simulateFail = null,
    idleMs = 3000,
    synthOptions = {},
    now = defaultNow,
    requestFrame = defaultRequestFrame,
    cancelFrame = defaultCancelFrame,
    inferenceIntervalMs = TIMING.inferenceIntervalMs
  } = {}) {
    this.onFrame = onFrame;
    this.onInference = onInference;
    this.simulateFail = simulateFail;
    this.idleMs = idleMs;
    this.synthOptions = synthOptions;
    this.now = now;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.inferenceIntervalMs = inferenceIntervalMs;

    this.running = false;
    this.target = null;
    this.failedTargetConsumed = false;
    this.failCurrentItem = false;
    this.itemStartedAt = null;
    this.streamStartedAt = null;
    this.lastInferenceAt = -Infinity;
    this.animationFrame = null;
    this.handlePageHide = () => this.stop();
    this.tick = () => {
      if (!this.running) return;
      this.emitOnce();
      if (this.running) this.animationFrame = this.requestFrame(this.tick);
    };
  }

  async start() {
    if (this.running) return this;
    const timestamp = this.now();
    this.running = true;
    this.streamStartedAt = timestamp;
    this.itemStartedAt = timestamp;
    this.lastInferenceAt = -Infinity;
    globalThis.addEventListener?.('pagehide', this.handlePageHide);
    this.animationFrame = this.requestFrame(this.tick);
    return this;
  }

  setTarget(verb) {
    this.target = verb || null;
    this.failCurrentItem = Boolean(
      this.target && this.target === this.simulateFail && !this.failedTargetConsumed
    );
    if (this.failCurrentItem) this.failedTargetConsumed = true;
    this.itemStartedAt = this.now();
  }

  emitOnce() {
    const timestamp = this.now();
    if (timestamp - this.lastInferenceAt < this.inferenceIntervalMs) return false;
    this.lastInferenceAt = timestamp;

    const itemElapsed = Math.max(0, timestamp - (this.itemStartedAt ?? timestamp));
    const shouldIdle = !this.target
      || this.failCurrentItem
      || itemElapsed < this.idleMs;
    const motion = shouldIdle ? 'idle' : this.target;
    const motionElapsed = shouldIdle ? itemElapsed : itemElapsed - this.idleMs;
    const frame = poseAt(motion, motionElapsed, this.synthOptions);
    frame.t = Math.max(0, timestamp - (this.streamStartedAt ?? timestamp));
    this.onFrame(frame);
    this.onInference({
      timestamp: frame.t,
      durationMs: 0,
      fps: 1000 / this.inferenceIntervalMs,
      delegate: 'SIMULATED'
    });
    return true;
  }

  stop() {
    if (!this.running && this.animationFrame === null) return;
    this.running = false;
    globalThis.removeEventListener?.('pagehide', this.handlePageHide);
    if (this.animationFrame !== null) {
      this.cancelFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  close() {
    this.stop();
  }
}
