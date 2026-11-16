import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';

// A cut is a distinct DOWN stroke over the board followed by an UP reset.
// Ignore the decorative board slice counter: it is not proof of a valid gesture.
export function createRecognizer(config) {
  let evidence, quality, detected, lastT, activeHand, startY, bottomY, startT, sampleCount, armed, strokes, lastStrokeT, missingSince;
  function resetStroke() {
    startY = null; bottomY = null; startT = null; sampleCount = 0;
  }
  function reset() {
    evidence = 0; quality = 0; detected = false; lastT = null;
    activeHand = null; armed = true; strokes = 0; lastStrokeT = -Infinity; missingSince = null;
    resetStroke();
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
        const candidates = pose?.ok
          ? [['l', pose.p.lWrist], ['r', pose.p.rWrist]].filter(([, wrist]) =>
              wrist && wrist.v > 0 && Math.abs(wrist.x) <= config.boardHalfWidth
              && wrist.y >= config.boardMinY && wrist.y <= config.boardMaxY)
          : [];
        const preferred = ctx.props?.propHand === 'left' ? 'l' : ctx.props?.propHand === 'right' ? 'r' : null;
        const selected = candidates.find(([hand]) => hand === activeHand)
          ?? candidates.find(([hand]) => hand === preferred) ?? candidates[0];
        if (!selected) {
          // A dropped camera landmark must not erase a partially completed cut.
          // Reset only after a sustained absence, not a one-frame dropout.
          missingSince ??= t;
          if (t - missingSince > 300) {
            activeHand = null;
            armed = true;
            resetStroke();
          }
        } else {
          missingSince = null;
          const [hand, wrist] = selected;
          if (hand !== activeHand) {
            activeHand = hand;
            armed = true;
            resetStroke();
          }
          const y = wrist.y;
          if (startY == null) {
            startY = y;
            bottomY = y;
            startT = t;
            sampleCount = 1;
          } else if (armed) {
            // Track the high point, but only accept a sufficiently long downward stroke.
            if (y < startY) { startY = y; startT = t; sampleCount = 1; }
            else sampleCount += 1;
            if (y - startY >= config.strokeDistance
                && t - startT >= (config.minStrokeMs ?? 120)
                && sampleCount >= 3
                && t - lastStrokeT >= (config.minStrokeGapMs ?? 250)) {
              strokes += 1;
              lastStrokeT = t;
              evidence = Math.min(1, evidence + config.strokeGain);
              quality = Math.max(quality, qualityFrom({
                amplitude: (y - startY) / config.amplitudePerfect,
                speed: config.qualitySpeed,
                repetition: strokes / config.strokesNeeded
              }));
              armed = false;
              bottomY = y;
            }
          } else {
            bottomY = Math.max(bottomY, y);
            if (bottomY - y >= config.resetDistance) {
              armed = true;
              startY = y;
              bottomY = y;
              startT = t;
              sampleCount = 1;
            }
          }
        }
        detected = strokes >= config.strokesNeeded && evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { strokes, activeHand, armed } };
    }
  };
}
