import { armOscillation, createContinuousRecognizer } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const motion = armOscillation(history, config);
    const fast = motion.frequency >= config.minFrequencyHz;
    const slow = motion.frequency >= config.slowFrequencyHz;
    const kneeSamples = motion.samples.filter((pose) => pose.p.lKnee?.v >= 0.45 && pose.p.rKnee?.v >= 0.45);
    const kneeSwing = kneeSamples.length > 4 ? Math.max(...kneeSamples.map(p => p.p.lKnee.y)) - Math.min(...kneeSamples.map(p => p.p.lKnee.y)) + Math.max(...kneeSamples.map(p => p.p.rKnee.y)) - Math.min(...kneeSamples.map(p => p.p.rKnee.y)) : null;
    const enough = motion.amplitude >= config.minAmplitude && motion.changes >= config.minHalfCycles && motion.phase <= config.phaseThreshold && slow && (kneeSwing == null || kneeSwing >= (config.minKneeSwing ?? 0.22));
    return {
      match: enough ? 1 : 0,
      gain: fast ? config.matchGain : config.slowGain,
      components: {
        amplitude: motion.amplitude / config.amplitudePerfect,
        speed: motion.frequency / config.frequencyPerfectHz,
        repetition: motion.changes / (config.minHalfCycles * 2)
      }
    };
  });
}
