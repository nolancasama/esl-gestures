export const QUALITY = Object.freeze({
  detectionMinimum: 50,
  maximum: 100,
  maxEvidenceDtSeconds: 0.25,
  good: Object.freeze({ min: 50, max: 69, label: 'GOOD!', stars: 1 }),
  great: Object.freeze({ min: 70, max: 89, label: 'GREAT!', stars: 2 }),
  perfect: Object.freeze({ min: 90, max: 100, label: 'PERFECT!', stars: 3 }),
  weights: Object.freeze({ amplitude: 0.4, speed: 0.25, repetition: 0.35 })
});
