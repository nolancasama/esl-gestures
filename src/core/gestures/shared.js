import { advanceEvidence, clamp, detectionQuality, qualityFrom } from './quality.js';

export const pointDistance = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;

export function poses(history, ms) {
  return history.window(ms).filter((pose) => pose?.ok);
}

export function values(samples, name, axis = 'y') {
  return samples.map((pose) => pose.p[name]).filter((point) => point && point.v > 0).map((point) => point[axis]);
}

export function range(series) {
  return series.length ? Math.max(...series) - Math.min(...series) : 0;
}

export function directionChanges(series, epsilon = 0) {
  const threshold = Math.max(0, Number(epsilon) || 0);
  if (threshold === 0) {
    let previousSign = 0;
    let changes = 0;
    for (let index = 1; index < series.length; index += 1) {
      const sign = Math.sign(series[index] - series[index - 1]);
      if (sign && previousSign && sign !== previousSign) changes += 1;
      if (sign) previousSign = sign;
    }
    return changes;
  }

  if (series.length < 2) return 0;
  let low = series[0];
  let high = series[0];
  let extreme = series[0];
  let direction = 0;
  let changes = 0;
  for (let index = 1; index < series.length; index += 1) {
    const value = series[index];
    if (direction === 0) {
      low = Math.min(low, value);
      high = Math.max(high, value);
      if (value - low >= threshold) {
        direction = 1;
        extreme = value;
      } else if (high - value >= threshold) {
        direction = -1;
        extreme = value;
      }
    } else if (direction > 0) {
      if (value > extreme) extreme = value;
      else if (extreme - value >= threshold) {
        changes += 1;
        direction = -1;
        extreme = value;
      }
    } else if (value < extreme) extreme = value;
    else if (value - extreme >= threshold) {
      changes += 1;
      direction = 1;
      extreme = value;
    }
  }
  return changes;
}

export function correlation(a, b) {
  const count = Math.min(a.length, b.length);
  if (count < 3) return 0;
  const av = a.slice(-count);
  const bv = b.slice(-count);
  const meanA = av.reduce((sum, value) => sum + value, 0) / count;
  const meanB = bv.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let index = 0; index < count; index += 1) {
    const da = av[index] - meanA;
    const db = bv[index] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  return numerator / Math.sqrt(denomA * denomB || 1);
}

export function averageSpeed(samples, names) {
  let distance = 0;
  let seconds = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const dt = (samples[index].t - samples[index - 1].t) / 1000;
    if (dt <= 0) continue;
    let step = 0;
    let count = 0;
    for (const name of names) {
      const a = samples[index - 1].p[name];
      const b = samples[index].p[name];
      if (a?.v > 0 && b?.v > 0) {
        step += pointDistance(a, b);
        count += 1;
      }
    }
    if (count) {
      distance += step / count;
      seconds += dt;
    }
  }
  return seconds ? distance / seconds : 0;
}

export function createContinuousRecognizer(config, evaluate) {
  let evidence = 0;
  let quality = 0;
  let detected = false;
  let lastT = null;
  return {
    reset() { evidence = 0; quality = 0; detected = false; lastT = null; },
    update(history, ctx = {}) {
      const t = ctx.t ?? history.latest()?.t ?? 0;
      const dt = lastT == null ? 0 : Math.max(0, (t - lastT) / 1000);
      lastT = t;
      if (!detected) {
        const result = evaluate(history, ctx) || {};
        evidence = advanceEvidence(evidence, result.match || 0, dt, config, result.gain ?? config.gain);
        quality = Math.max(quality, qualityFrom(result.components));
        detected = evidence >= 1;
      }
      if (detected) quality = detectionQuality(quality);
      return { detected, evidence: detected ? 1 : evidence, quality, debug: {} };
    }
  };
}

export function eventResult(state, quality, debug = {}) {
  return { detected: state.detected, evidence: state.detected ? 1 : clamp(state.evidence), quality: state.detected ? detectionQuality(quality) : quality, debug };
}

export function armOscillation(history, config) {
  const samples = poses(history, config.analysisMs);
  const left = values(samples, 'lWrist');
  const right = values(samples, 'rWrist');
  const leftRange = range(left);
  const rightRange = range(right);
  const amplitude = Math.min(leftRange, rightRange);
  const changes = Math.min(
    directionChanges(left, config.directionChangeEpsilon),
    directionChanges(right, config.directionChangeEpsilon)
  );
  const duration = samples.length > 1 ? (samples.at(-1).t - samples[0].t) / 1000 : 0;
  // A finite window usually begins and ends part-way through a half-cycle.
  // Once a real reversal is confirmed, include that observed boundary span in
  // the frequency estimate without manufacturing any turns for a flat signal.
  const frequency = duration && changes ? (changes + 1) / (duration * 2) : 0;
  const phase = correlation(left, right);
  return { samples, amplitude, changes, frequency, phase };
}
