import { armOscillation, createContinuousRecognizer } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const motion = armOscillation(history, config);
    const enough = motion.amplitude >= config.minAmplitude && motion.frequency >= config.minFrequencyHz && motion.changes >= config.minHalfCycles && motion.phase <= config.phaseThreshold;
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
