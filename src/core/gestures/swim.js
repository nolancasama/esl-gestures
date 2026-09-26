import { averageSpeed, createContinuousRecognizer, directionChanges, poses, range, values } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const samples = poses(history, config.analysisMs);
    const leftX = values(samples, 'lWrist', 'x');
    const rightX = values(samples, 'rWrist', 'x');
    const leftY = values(samples, 'lWrist', 'y');
    const rightY = values(samples, 'rWrist', 'y');
    const excursion = Math.min(Math.hypot(range(leftX), range(leftY)), Math.hypot(range(rightX), range(rightY)));
    const cycles = Math.min(
      directionChanges(leftX, config.directionChangeEpsilon) + directionChanges(leftY, config.directionChangeEpsilon),
      directionChanges(rightX, config.directionChangeEpsilon) + directionChanges(rightY, config.directionChangeEpsilon)
    ) / 2;
    const speed = averageSpeed(samples, ['lWrist', 'rWrist']);
    const enough = excursion >= config.minExcursion && cycles >= config.minCycles;
    return {
      match: enough ? 1 : 0,
      gain: config.cycleGain,
      components: { amplitude: excursion / config.amplitudePerfect, speed: speed / config.speedPerfect, repetition: cycles / (config.minCycles * 2) }
    };
  });
}
