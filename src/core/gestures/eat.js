import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';
import { pointDistance } from './shared.js';

export function createRecognizer(config) {
  let evidence, quality, detected, lastT, nearSince, armed, approaches;
  function reset() { evidence = 0; quality = 0; detected = false; lastT = null; nearSince = null; armed = true; approaches = 0; }
  reset();
  return {
    reset,
    update(history, ctx = {}) {
      const pose = history.latest();
      const t = ctx.t ?? pose?.t ?? 0;
      const dt = lastT == null ? 0 : Math.max(0, (t - lastT) / 1000);
      lastT = t;
      if (!detected && pose?.ok) {
        evidence = advanceEvidence(evidence, 0, dt, config);
        const propHand = ctx.props?.propHand ?? ctx.props?.hand;
        const wrist = propHand === 'left' || propHand === 'l' ? pose.p.lWrist : propHand === 'right' || propHand === 'r' ? pose.p.rWrist : [pose.p.lWrist, pose.p.rWrist].sort((a, b) => pointDistance(a, pose.p.mouth) - pointDistance(b, pose.p.mouth))[0];
        const distance = pointDistance(wrist, pose.p.mouth);
        if (distance >= config.resetDistance) { armed = true; nearSince = null; }
        if (distance <= config.mouthDistance) {
          nearSince ??= t;
          if (armed) {
            armed = false; approaches += 1; evidence = Math.min(1, evidence + config.approachGain);
          }
          if (t - nearSince >= config.singleHoldMs) evidence = 1;
          quality = Math.max(quality, qualityFrom({ amplitude: 1 - distance / config.mouthDistance, speed: config.qualitySpeed, repetition: approaches / config.approachesNeeded }));
        }
        detected = evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { approaches, nearMs: nearSince == null ? 0 : t - nearSince } };
    }
  };
}
