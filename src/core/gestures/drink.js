import { createContinuousRecognizer, pointDistance } from './shared.js';

function selectedWrist(pose, props) {
  const hand = props?.propHand ?? props?.hand;
  if (hand === 'left' || hand === 'l') return pose.p.lWrist;
  if (hand === 'right' || hand === 'r') return pose.p.rWrist;
  return pointDistance(pose.p.lWrist, pose.p.mouth) < pointDistance(pose.p.rWrist, pose.p.mouth) ? pose.p.lWrist : pose.p.rWrist;
}

export function createRecognizer(config) {
  return createContinuousRecognizer(config, (history, ctx) => {
    const pose = history.latest();
    if (!pose?.ok) return {};
    const distance = pointDistance(selectedWrist(pose, ctx.props), pose.p.mouth);
    return {
      match: distance <= config.mouthDistance ? 1 : 0,
      gain: config.holdGain,
      components: { amplitude: 1 - distance / config.mouthDistance, speed: config.holdQuality, repetition: config.holdQuality }
    };
  });
}
