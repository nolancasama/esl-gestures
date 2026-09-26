import { armOscillation, createContinuousRecognizer } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const motion = armOscillation(history, config);
    const fast = motion.frequency >= config.minFrequencyHz;
    const slow = motion.frequency >= config.slowFrequencyHz;
    const enough = motion.amplitude >= config.minAmplitude && motion.changes >= config.minHalfCycles && motion.phase <= config.phaseThreshold && slow;
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
