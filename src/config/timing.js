export const TIMING = Object.freeze({
  inferenceIntervalMs: 55,
  speechDelayMs: 400,
  contextStageMs: 2500,
  glossStageMs: 5500,
  demoStageMs: 9000,
  autoAdvanceMs: 20000,
  hintCheckIntervalMs: 500,
  hintEvidenceThreshold: 0.35,
  successDelayMs: 1600,
  catchFlightMs: 1400,
  catchArrivalBeforeMs: 300,
  catchArrivalAfterMs: 400,
  catchRelaunchMs: 600
});

export const HISTORY = Object.freeze({
  windowMs: 2500,
  jumpBaselineMs: 1000,
  propHandWindowMs: 500
});

export const POSE = Object.freeze({
  minVisibility: 0.45,
  scaleEmaAlpha: 0.25,
  scaleFloorRatio: 0.7,
  scalePeakHalfLifeMs: 1200,
  torsoScaleRatio: 0.87,
  minShoulderWidth: 0.015,
  setupHoldMs: 500
});
