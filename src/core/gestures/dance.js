import { averageSpeed, createContinuousRecognizer, directionChanges, poses, values } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const samples = poses(history, config.analysisMs);
    const energy = averageSpeed(samples, ['lWrist', 'rWrist', 'lElbow', 'rElbow', 'nose', 'lShoulder', 'rShoulder']);
    const changes = directionChanges(values(samples, 'lWrist', 'x'), config.directionChangeEpsilon)
      + directionChanges(values(samples, 'rWrist', 'y'), config.directionChangeEpsilon);
    const leftTravel = Math.max(...values(samples, 'lWrist', 'x')) - Math.min(...values(samples, 'lWrist', 'x'));
    const rightTravel = Math.max(...values(samples, 'rWrist', 'y')) - Math.min(...values(samples, 'rWrist', 'y'));
    const enough = energy >= config.energyThreshold && changes >= config.minDirectionChanges && leftTravel >= 0.25 && rightTravel >= 0.25;
    return {
      match: enough ? 1 : 0,
      gain: config.matchGain,
      components: { amplitude: energy / config.energyPerfect, speed: energy / config.energyPerfect, repetition: changes / config.changePerfect }
    };
  });
}
