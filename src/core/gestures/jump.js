import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';

export function createRecognizer(config) {
  let evidence;
  let quality;
  let detected;
  let baseline;
  let airborne;
  let peak;
  let takeoffT;
  let lastT;

  function reset() {
    evidence = 0; quality = 0; detected = false; baseline = null; airborne = false; peak = 0; takeoffT = 0; lastT = null;
  }
  reset();

  return {
    reset,
    update(history, ctx = {}) {
      const pose = history.latest();
      const t = ctx.t ?? pose?.t ?? 0;
      const dt = lastT == null ? 0 : Math.max(0, (t - lastT) / 1000);
      lastT = t;
      if (!detected && pose?.ok) {
        baseline ??= pose.origin.y;
        const rise = (baseline - pose.origin.y) / pose.scale;
        let eventGain = 0;
        if (!airborne && rise >= config.smallRise) {
          airborne = true; peak = rise; takeoffT = t;
        }
        if (airborne) {
          peak = Math.max(peak, rise);
          const returned = rise <= config.returnTolerance;
          const timedOut = t - takeoffT > config.maxBounceMs;
          if (returned || timedOut) {
            if (returned) eventGain = peak >= config.rise ? config.clearGain : config.smallGain;
            airborne = false;
            const armsUp = Math.min(pose.p.lWrist.y, pose.p.rWrist.y) <= config.armsUpY;
            quality = Math.max(quality, qualityFrom({ amplitude: peak / config.amplitudePerfect, speed: config.maxBounceMs / Math.max(1, t - takeoffT), repetition: armsUp ? config.armsUpQuality : config.armsDownQuality }));
            peak = 0;
          }
        } else {
          baseline += (pose.origin.y - baseline) * config.baselineAlpha;
        }
        evidence = advanceEvidence(evidence, 0, dt, config);
        evidence = Math.min(1, evidence + eventGain);
        detected = evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { rise: pose?.ok && baseline != null ? (baseline - pose.origin.y) / pose.scale : 0, peak } };
    }
  };
}
