import { advanceEvidence, detectionQuality, qualityFrom } from './quality.js';

export function createRecognizer(config) {
  let evidence, quality, detected, lastT, lastHand, events, handState;
  function reset() {
    evidence = 0; quality = 0; detected = false; lastT = null; lastHand = null; events = 0;
    handState = {
      l: { armed: true, peakY: Infinity, exitedReach: true },
      r: { armed: true, peakY: Infinity, exitedReach: true }
    };
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
        evidence = advanceEvidence(evidence, 0, dt, config);
        for (const hand of ['l', 'r']) {
          const wrist = pose.p[`${hand}Wrist`];
          const state = handState[hand];
          if (!state.armed) {
            state.peakY = Math.min(state.peakY, wrist.y);
            if (wrist.y >= config.returnY || wrist.y - state.peakY >= config.rearmDrop) {
              state.armed = true;
              state.exitedReach = wrist.y > config.reachY;
            }
          } else if (!state.exitedReach && wrist.y > config.reachY) {
            state.exitedReach = true;
          }
          if (state.armed && state.exitedReach && wrist.y <= config.reachY) {
            state.armed = false;
            state.peakY = wrist.y;
            state.exitedReach = false;
            const alternating = lastHand !== hand;
            evidence = Math.min(1, evidence + (alternating ? config.alternateGain : config.repeatGain));
            lastHand = hand; events += 1;
            quality = Math.max(quality, qualityFrom({ amplitude: Math.abs(wrist.y / config.reachPerfect), speed: alternating ? 1 : config.repeatQuality, repetition: events / config.eventsNeeded }));
          }
        }
        detected = evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: { events, lastHand } };
    }
  };
}
