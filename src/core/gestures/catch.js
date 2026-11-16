import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';
import { pointDistance } from './shared.js';

export function createRecognizer(config) {
  let evidence = 0, quality = 0, detected = false, lastT = null, lastLaunch = null, priorAway = false;
  function reset() { evidence = 0; quality = 0; detected = false; lastT = null; lastLaunch = null; priorAway = false; }
  return {
    reset,
    update(history, ctx = {}) {
      const pose = history.latest();
      const t = ctx.t ?? pose?.t ?? 0;
      const dt = lastT == null ? 0 : Math.max(0, (t - lastT) / 1000);
      lastT = t;
      if (!detected) {
        evidence = advanceEvidence(evidence, 0, dt, config);
        const prop = ctx.props;
        if (prop?.launchTime !== lastLaunch) { lastLaunch = prop?.launchTime; priorAway = false; }
        const ball = prop?.ball;
        if (pose?.ok && ball && Number.isFinite(ball.x) && Number.isFinite(ball.y)) {
          const distance = Math.min(pointDistance(pose.p.lWrist, ball), pointDistance(pose.p.rWrist, ball));
          if (distance >= config.catchDistance * 1.25) priorAway = true;
          // Require an active approach and a catch confirmed during the ball's arrival.
          if (priorAway && prop?.caught && prop?.caughtBy && prop?.launchTime != null &&
              t - prop.launchTime >= 1000 && t - prop.launchTime <= 1900) {
            evidence = 1;
            quality = qualityFrom({ amplitude: 0.8, speed: config.qualitySpeed, repetition: 1 });
          }
        }
        detected = evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { priorAway } };
    }
  };
}
