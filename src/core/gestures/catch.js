import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';
import { pointDistance } from './shared.js';

export function createRecognizer(config) {
  let evidence, quality, detected, lastT;
  function reset() { evidence = 0; quality = 0; detected = false; lastT = null; }
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
        const ball = ctx.props?.ball?.position ?? ctx.props?.ball ?? ctx.props?.position;
        const caught = Boolean(ctx.props?.caught ?? ctx.props?.ball?.caught);
        let distance = Infinity;
        if (pose?.ok && ball && Number.isFinite(ball.x) && Number.isFinite(ball.y)) distance = Math.min(pointDistance(pose.p.lWrist, ball), pointDistance(pose.p.rWrist, ball));
        if (caught || distance <= config.catchDistance) {
          evidence = Math.min(1, evidence + config.catchGain);
          quality = qualityFrom({ amplitude: 1 - distance / config.catchDistance, speed: config.qualitySpeed, repetition: 1 });
        }
        detected = evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: {} };
    }
  };
}
