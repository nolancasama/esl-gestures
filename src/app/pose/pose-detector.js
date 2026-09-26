import { TIMING } from '../../config/timing.js';

const CAMERA_CONSTRAINTS = Object.freeze({
  audio: false,
  video: Object.freeze({ width: 640, height: 480, facingMode: 'user' })
});

const defaultNow = () => globalThis.performance?.now?.() ?? Date.now();
const defaultRequestFrame = (callback) => globalThis.requestAnimationFrame
  ? globalThis.requestAnimationFrame(callback)
  : globalThis.setTimeout(() => callback(defaultNow()), 16);
const defaultCancelFrame = (handle) => globalThis.cancelAnimationFrame
  ? globalThis.cancelAnimationFrame(handle)
  : globalThis.clearTimeout(handle);

function baseUrl() {
  const configured = import.meta.env?.BASE_URL || '/';
  return configured.endsWith('/') ? configured : `${configured}/`;
}

function localAsset(path, root = baseUrl()) {
  const prefix = root.endsWith('/') ? root : `${root}/`;
  return `${prefix}${path.replace(/^\/+/, '')}`;
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() ?? []) track.stop();
}

function toPoseFrame(result, timestamp) {
  // Current Tasks Vision releases use `landmarks`; accepting `poseLandmarks`
  // keeps the adapter isolated from older MediaPipe result naming.
  const poses = result?.landmarks ?? result?.poseLandmarks ?? [];
  const pose = Array.isArray(poses[0]) ? poses[0] : null;

  return {
    t: timestamp,
    landmarks: pose?.map((landmark) => ({
      x: 1 - landmark.x,
      y: landmark.y,
      z: landmark.z ?? 0,
      v: landmark.visibility ?? landmark.presence ?? 1
    })) ?? null
  };
}

async function createLandmarker(moduleLoader, wasmPath, modelPath) {
  const { FilesetResolver, PoseLandmarker } = await moduleLoader();
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  const errors = [];

  for (const delegate of ['GPU', 'CPU']) {
    try {
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1
      });
      return { landmarker, delegate };
    } catch (error) {
      errors.push(error);
    }
  }

  throw new AggregateError(errors, 'MediaPipe Pose Landmarker could not be loaded');
}

/**
 * Camera-backed pose source. Frames sent to `onFrame` already use mirrored
 * display coordinates, matching the PoseFrame contract in SPEC.md.
 */
export class PoseDetector {
  constructor({
    video,
    onFrame = () => {},
    onInference = () => {},
    onError = () => {},
    assetBaseUrl = baseUrl(),
    mediaDevices = globalThis.navigator?.mediaDevices,
    moduleLoader = () => import('@mediapipe/tasks-vision'),
    now = defaultNow,
    requestFrame = defaultRequestFrame,
    cancelFrame = defaultCancelFrame,
    inferenceIntervalMs = TIMING.inferenceIntervalMs
  } = {}) {
    if (!video) throw new TypeError('PoseDetector requires a video element');

    this.video = video;
    this.onFrame = onFrame;
    this.onInference = onInference;
    this.onError = onError;
    this.assetBaseUrl = assetBaseUrl;
    this.mediaDevices = mediaDevices;
    this.moduleLoader = moduleLoader;
    this.now = now;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.inferenceIntervalMs = inferenceIntervalMs;

    this.running = false;
    this.delegate = null;
    this.inferenceFps = 0;
    this.stream = null;
    this.landmarker = null;
    this.animationFrame = null;
    this.startPromise = null;
    this.runToken = 0;
    this.lastInferenceAt = -Infinity;
    this.lastVideoTime = null;
    this.lastCompletedInferenceAt = null;
    this.handlePageHide = () => this.stop();
    this.tick = () => {
      if (!this.running) return;
      this.inferOnce();
      if (this.running) this.animationFrame = this.requestFrame(this.tick);
    };
  }

  async start() {
    if (this.running) return this.startPromise ?? this;
    if (!this.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not available in this browser');
    }

    this.running = true;
    const token = ++this.runToken;
    globalThis.addEventListener?.('pagehide', this.handlePageHide);

    this.startPromise = (async () => {
      let stream;
      let loaded;
      try {
        stream = await this.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (!this.running || token !== this.runToken) {
          stopStream(stream);
          return this;
        }

        this.stream = stream;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.srcObject = stream;
        await this.video.play();

        loaded = await createLandmarker(
          this.moduleLoader,
          localAsset('mediapipe/wasm', this.assetBaseUrl),
          localAsset('models/pose_landmarker_lite.task', this.assetBaseUrl)
        );
        if (!this.running || token !== this.runToken) {
          loaded.landmarker.close();
          return this;
        }

        this.landmarker = loaded.landmarker;
        this.delegate = loaded.delegate;
        this.lastInferenceAt = -Infinity;
        this.lastVideoTime = null;
        this.lastCompletedInferenceAt = null;
        this.animationFrame = this.requestFrame(this.tick);
        return this;
      } catch (error) {
        if (loaded && loaded.landmarker !== this.landmarker) loaded.landmarker.close();
        this.stop();
        throw error;
      }
    })();

    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  inferOnce() {
    if (!this.landmarker || this.video.readyState < 2) return false;

    const timestamp = this.now();
    const videoTime = this.video.currentTime;
    if (timestamp - this.lastInferenceAt < this.inferenceIntervalMs || videoTime === this.lastVideoTime) {
      return false;
    }

    this.lastInferenceAt = timestamp;
    this.lastVideoTime = videoTime;
    const startedAt = this.now();
    try {
      const result = this.landmarker.detectForVideo(this.video, timestamp);
      const completedAt = this.now();
      if (this.lastCompletedInferenceAt !== null) {
        const interval = completedAt - this.lastCompletedInferenceAt;
        const sample = interval > 0 ? 1000 / interval : 0;
        this.inferenceFps = this.inferenceFps === 0
          ? sample
          : this.inferenceFps * 0.8 + sample * 0.2;
      }
      this.lastCompletedInferenceAt = completedAt;
      this.onFrame(toPoseFrame(result, timestamp));
      this.onInference({
        timestamp,
        durationMs: completedAt - startedAt,
        fps: this.inferenceFps,
        delegate: this.delegate
      });
      return true;
    } catch (error) {
      this.stop();
      this.onError(error);
      return false;
    }
  }

  // Kept for a common detector interface. A real detector is target-agnostic.
  setTarget() {}

  stop() {
    if (!this.running && !this.stream && !this.landmarker) return;
    this.running = false;
    this.runToken += 1;
    globalThis.removeEventListener?.('pagehide', this.handlePageHide);

    if (this.animationFrame !== null) {
      this.cancelFrame(this.animationFrame);
      this.animationFrame = null;
    }
    stopStream(this.stream);
    this.stream = null;

    if (this.video.srcObject) this.video.srcObject = null;
    this.video.pause?.();

    try {
      this.landmarker?.close();
    } finally {
      this.landmarker = null;
      this.delegate = null;
      this.lastVideoTime = null;
    }
  }

  close() {
    this.stop();
  }
}

export { CAMERA_CONSTRAINTS, toPoseFrame };
