import { createContinuousRecognizer, poses, range, values } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const samples = poses(history, config.holdMs);
    const latest = samples.at(-1);
    if (!latest) return {};
    const shoulders = (latest.p.lShoulder.y + latest.p.rShoulder.y) / 2;
    const raised = [latest.p.lWrist, latest.p.rWrist].some((wrist) => wrist.y - shoulders <= config.minPalmHeight && Math.abs(wrist.x) >= config.minSeparation);
    const positionRange = Math.max(
      range(values(samples, 'lWrist', 'x')),
      range(values(samples, 'lWrist', 'y')),
      range(values(samples, 'rWrist', 'x')),
      range(values(samples, 'rWrist', 'y'))
    );
    return {
      match: raised && positionRange <= config.maxPositionRange ? 1 : 0,
      gain: config.holdGain,
      components: { amplitude: raised ? 1 : 0, speed: 1 - positionRange / config.maxPositionRange, repetition: samples.length > 1 ? 1 : 0 }
    };
  });
}
