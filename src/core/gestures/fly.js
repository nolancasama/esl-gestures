import { createContinuousRecognizer, pointDistance, poses, range, values } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const samples = poses(history, config.holdMs);
    const latest = samples.at(-1);
    if (!latest) return {};
    const left = latest.p.lWrist;
    const right = latest.p.rWrist;
    const shoulderY = (latest.p.lShoulder.y + latest.p.rShoulder.y) / 2;
    const spread = Math.abs(left.x - right.x);
    const height = Math.max(Math.abs(left.y - shoulderY), Math.abs(right.y - shoulderY));
    const flap = range(values(samples, 'lWrist')) + range(values(samples, 'rWrist'));
    const enough = spread >= config.minSpread && height <= config.maxVerticalOffset;
    return {
      match: enough ? 1 : 0,
      gain: config.holdGain,
      components: { amplitude: spread / config.spreadPerfect, speed: flap / config.flapPerfect, repetition: samples.length ? pointDistance(left, right) / config.spreadPerfect : 0 }
    };
  });
}
