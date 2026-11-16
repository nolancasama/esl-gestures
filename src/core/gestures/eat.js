import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';
import { pointDistance } from './shared.js';

export function createRecognizer(config) {
  let evidence, quality, detected, lastT, armed, approaches, hand, seenAway;
  function reset() {
    evidence = 0; quality = 0; detected = false; lastT = null;
    armed = true; approaches = 0; hand = null; seenAway = false;
  }
  reset();
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
          const selected = ctx.props?.propHand === 'left' ? 'l' : ctx.props?.propHand === 'right' ? 'r' : hand;
          const distances = {
            l: pointDistance(pose.p.lWrist, pose.p.mouth),
            r: pointDistance(pose.p.rWrist, pose.p.mouth)
          };
          hand ??= selected ?? (distances.l < distances.r ? 'l' : 'r');
          const distance = distances[hand];
          if (distance >= config.resetDistance) {
            armed = true;
            seenAway = true;
          }
          if (armed && seenAway && distance <= config.mouthDistance) {
            armed = false;
            approaches += 1;
            evidence = Math.min(1, evidence + config.approachGain);
            quality = Math.max(quality, qualityFrom({
              amplitude: 1 - distance / config.mouthDistance,
              speed: config.qualitySpeed,
              repetition: approaches / config.approachesNeeded
            }));
          }
          // A stationary hand beside the face is never an eating gesture.
          detected = approaches >= config.approachesNeeded && evidence >= 1;
        }
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { approaches, armed, seenAway } };
    }
  };
}
