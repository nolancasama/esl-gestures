import { TIMING } from '../../config/timing.js';

function finiteEvidence(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export class HintManager {
  constructor(config = TIMING) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.stage = 0;
    this.autoAdvanced = false;
    this.lastT = -Infinity;
    this.nextCheckT = this.config.hintCheckIntervalMs;
    this.evidenceHistory = [];
    return { stage: this.stage, events: [], autoAdvanced: false };
  }

  evidenceAt(t) {
    let evidence = 0;
    for (const sample of this.evidenceHistory) {
      if (sample.t > t) break;
      evidence = sample.evidence;
    }
    return evidence;
  }

  update(t, evidence) {
    if (!Number.isFinite(t) || t < 0) throw new TypeError('Hint time must be a non-negative number');
    if (t < this.lastT) throw new RangeError('Hint time must be monotonic');

    const sample = { t, evidence: finiteEvidence(evidence) };
    if (this.evidenceHistory.at(-1)?.t === t) this.evidenceHistory[this.evidenceHistory.length - 1] = sample;
    else this.evidenceHistory.push(sample);

    const events = [];
    while (this.nextCheckT <= t && !this.autoAdvanced) {
      const checkT = this.nextCheckT;
      const checkEvidence = this.evidenceAt(checkT);
      if (checkEvidence < this.config.hintEvidenceThreshold) {
        const deadlines = [
          this.config.contextStageMs,
          this.config.glossStageMs,
          this.config.demoStageMs
        ];
        const nextStage = this.stage + 1;
        if (nextStage <= deadlines.length && checkT >= deadlines[nextStage - 1]) {
          this.stage = nextStage;
          events.push({ type: 'stage', stage: this.stage, t: checkT });
        } else if (this.stage === deadlines.length && checkT >= this.config.autoAdvanceMs) {
          this.autoAdvanced = true;
          events.push({ type: 'autoAdvance', t: checkT });
        }
      }
      this.nextCheckT += this.config.hintCheckIntervalMs;
    }

    this.lastT = t;
    return { stage: this.stage, events, autoAdvanced: this.autoAdvanced };
  }
}

export function createHintManager(config) {
  return new HintManager(config);
}
