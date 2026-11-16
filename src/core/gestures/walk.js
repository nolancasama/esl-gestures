import { armOscillation, createContinuousRecognizer } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const motion = armOscillation(history, config);
    const kneeSamples = motion.samples.filter((pose) => pose.p.lKnee?.v >= 0.45 && pose.p.rKnee?.v >= 0.45);
    const kneeSwing = kneeSamples.length > 4 ? Math.max(...kneeSamples.map(p => p.p.lKnee.y)) - Math.min(...kneeSamples.map(p => p.p.lKnee.y)) + Math.max(...kneeSamples.map(p => p.p.rKnee.y)) - Math.min(...kneeSamples.map(p => p.p.rKnee.y)) : null;
    const enough = motion.amplitude >= config.minAmplitude && motion.frequency >= config.minFrequencyHz && motion.changes >= config.minHalfCycles && motion.phase <= config.phaseThreshold && (kneeSwing == null || kneeSwing >= (config.minKneeSwing ?? 0.10));
    return {
      match: enough ? 1 : 0,
      gain: config.matchGain,
      components: {
        amplitude: motion.amplitude / config.amplitudePerfect,
        speed: motion.frequency / config.frequencyPerfectHz,
        repetition: motion.changes / (config.minHalfCycles * 2)
      }
    };
  });
}
