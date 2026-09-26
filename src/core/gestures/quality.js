import { QUALITY } from '../../config/quality.js';

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function advanceEvidence(evidence, match, dtSeconds, config, gain = config.gain) {
  const dt = clamp(dtSeconds, 0, QUALITY.maxEvidenceDtSeconds);
  return clamp(evidence + gain * clamp(match) * dt - config.decay * dt);
}

export function qualityFrom({ amplitude = 0, speed = 0, repetition = 0 } = {}) {
  const weighted =
    QUALITY.weights.amplitude * clamp(amplitude) +
    QUALITY.weights.speed * clamp(speed) +
    QUALITY.weights.repetition * clamp(repetition);
  return Math.round(QUALITY.detectionMinimum + (QUALITY.maximum - QUALITY.detectionMinimum) * weighted);
}

export function detectionQuality(quality) {
  return Math.round(clamp(quality, QUALITY.detectionMinimum, QUALITY.maximum));
}

export function rate(quality) {
  const value = Math.round(clamp(quality, QUALITY.detectionMinimum, QUALITY.maximum));
  const band = value >= QUALITY.perfect.min ? QUALITY.perfect : value >= QUALITY.great.min ? QUALITY.great : QUALITY.good;
  return { quality: value, label: band.label, stars: band.stars, band: band.label.slice(0, -1) };
}
