import { averageSpeed, createContinuousRecognizer, directionChanges, pointDistance, poses, values } from './shared.js';

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history) => {
    const samples = poses(history, config.holdMs);
    const latest = samples.at(-1);
    if (!latest) return {};
    const distance = pointDistance(latest.p.lWrist, latest.p.rWrist);
    const relative = samples.map((pose) => pose.p.lWrist.x - pose.p.rWrist.x);
    const changes = directionChanges(relative, config.directionChangeEpsilon);
    const speed = averageSpeed(samples, ['lWrist', 'rWrist']);
    const enough = distance <= config.maxHandDistance && speed >= config.minRelativeSpeed && changes >= config.minDirectionChanges;
    return {
      match: enough ? 1 : 0,
      gain: config.holdGain,
      components: { amplitude: 1 - distance / config.maxHandDistance, speed: speed / config.speedPerfect, repetition: changes / config.changesPerfect }
    };
  });
}
