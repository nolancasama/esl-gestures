import { averageSpeed, createContinuousRecognizer, directionChanges, poses, values } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const samples = poses(history, config.analysisMs);
    const energy = averageSpeed(samples, ['lWrist', 'rWrist', 'lElbow', 'rElbow', 'nose', 'lShoulder', 'rShoulder']);
    const changes = directionChanges(values(samples, 'lWrist', 'x'), config.directionChangeEpsilon)
      + directionChanges(values(samples, 'rWrist', 'y'), config.directionChangeEpsilon);
    const enough = energy >= config.energyThreshold && changes >= config.minDirectionChanges;
    return {
      match: enough ? 1 : 0,
      gain: config.matchGain,
      components: { amplitude: energy / config.energyPerfect, speed: energy / config.energyPerfect, repetition: changes / config.changePerfect }
    };
  });
}
