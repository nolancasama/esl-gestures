import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';
import { pointDistance } from './shared.js';

export function createRecognizer(config) {
  let evidence = 0, quality = 0, detected = false, lastT = null, hand = null;
  let seenAway = false, nearSince = null;
  function reset() {
    evidence = 0; quality = 0; detected = false; lastT = null;
    hand = null; seenAway = false; nearSince = null;
  }
  return {
    reset,
    update(history, ctx = {}) {
      const pose = history.latest();
      const t = ctx.t ?? pose?.t ?? 0;
      const dt = lastT == null ? 0 : Math.max(0, (t - lastT) / 1000);
      lastT = t;
      if (!detected) {
        evidence = advanceEvidence(evidence, 0, dt, config);
        if (pose?.ok) {
          const selected = ctx.props?.propHand === 'left' ? 'l' : ctx.props?.propHand === 'right' ? 'r' : null;
          hand ??= selected ?? (pointDistance(pose.p.lWrist, pose.p.mouth) < pointDistance(pose.p.rWrist, pose.p.mouth) ? 'l' : 'r');
          const distance = pointDistance(pose.p[`${hand}Wrist`], pose.p.mouth);
          if (distance >= (config.resetDistance ?? 1.35)) {
            seenAway = true;
            nearSince = null;
          }
          if (seenAway && distance <= config.mouthDistance) {
            nearSince ??= t;
            if (t - nearSince >= (config.holdMs ?? 450)) {
              evidence = 1;
              quality = qualityFrom({ amplitude: 1 - distance / config.mouthDistance, speed: 0.75, repetition: 1 });
            }
          } else if (distance > config.mouthDistance) nearSince = null;
          detected = evidence >= 1;
        }
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { seenAway, nearMs: nearSince == null ? 0 : t - nearSince } };
    }
  };
}
