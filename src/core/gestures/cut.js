import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';

export function createRecognizer(config) {
  let evidence, quality, detected, lastT, activeHand, topY, bottomY, strokes;
  function reset() { evidence = 0; quality = 0; detected = false; lastT = null; activeHand = null; topY = null; bottomY = null; strokes = 0; }
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
        const candidates = [['l', pose.p.lWrist], ['r', pose.p.rWrist]].filter(([, wrist]) => Math.abs(wrist.x) <= config.boardHalfWidth && wrist.y >= config.boardMinY && wrist.y <= config.boardMaxY);
        const propHand = ctx.props?.propHand;
        const preferred = propHand === 'left' ? 'l' : propHand === 'right' ? 'r' : propHand;
        const selected = candidates.find(([hand]) => hand === preferred) ?? candidates.find(([hand]) => hand === activeHand) ?? candidates[0];
        if (selected) {
          activeHand = selected[0];
          const y = selected[1].y;
          topY = topY == null ? y : Math.min(topY, y);
          bottomY = bottomY == null ? y : Math.max(bottomY, y);
          const excursion = bottomY - topY;
          if (excursion >= config.strokeDistance && y <= bottomY - config.resetDistance) {
            strokes += 1;
            evidence = Math.min(1, evidence + config.strokeGain);
            quality = Math.max(quality, qualityFrom({ amplitude: excursion / config.amplitudePerfect, speed: config.qualitySpeed, repetition: strokes / config.strokesNeeded }));
            topY = y; bottomY = y;
          }
        }
        const propSlices = ctx.props?.slices?.length ?? ctx.props?.sliceCount ?? 0;
        if (propSlices >= config.strokesNeeded) evidence = 1;
        detected = evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { strokes, activeHand } };
    }
  };
}
