import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POOL } from '../../config/vocab.js';
import { createPoseNormalizer } from '../pose/normalize.js';
import { PoseHistory } from '../pose/history.js';
import { generateFrames } from '../synth/generate.js';
import { createCatchBallState, createCupState, createCuttingBoardState, createOnigiriState, createWashBubblesState } from '../props/index.js';
import { getRecognizer } from './index.js';
import { directionChanges } from './shared.js';

const ALL_VERBS = [...DEFAULT_POOL, 'stop'];
const CATCH_TARGET = Object.freeze({ x: 1.05, y: -0.55 });

function propController(verb) {
  if (verb === 'drink') return createCupState();
  if (verb === 'eat') return createOnigiriState();
  if (verb === 'cut') return createCuttingBoardState();
  if (verb === 'catch') return createCatchBallState({ seed: 4, target: CATCH_TARGET });
  if (verb === 'wash') return createWashBubblesState();
  return null;
}

function run(targetVerb, motionVerb, options = {}) {
  const normalizer = createPoseNormalizer();
  const history = new PoseHistory();
  const recognizer = getRecognizer(targetVerb);
  const props = propController(targetVerb);
  let result = { detected: false, evidence: 0, quality: 0, debug: {} };
  const frameOptions = {
    durationMs: options.durationMs ?? 6000,
    fps: options.fps ?? 20,
    ...options,
    ...(motionVerb === 'catch' ? { catchTarget: CATCH_TARGET } : {})
  };
  for (const frame of generateFrames(motionVerb, frameOptions)) {
    history.push(normalizer.normalizePose(frame, 1));
    const propState = props?.update(history, frame.t) ?? null;
    result = recognizer.update(history, { t: frame.t, props: propState });
    if (result.detected) return { ...result, t: frame.t };
  }
  return { ...result, t: frameOptions.durationMs };
}

test('extreme-tracking hysteresis ignores jitter and counts confirmed turns once', () => {
  assert.equal(directionChanges([0, 0.04, -0.03, 0.05, -0.04], 0.15), 0);
  assert.equal(directionChanges([0, 0.5, 0.42, 0.36], 0.15), 0);
  assert.equal(directionChanges([0, 0.5, 0.34, 0.2, 0.28, 0.36], 0.15), 2);
});

test('every synthetic verb is recognised across scale, mirror, speed, realistic jitter, dropout, and seed variations', () => {
  const failures = [];
  for (const verb of ALL_VERBS) {
    for (const seed of [1, 2, 3]) {
      for (const scale of [0.6, 1, 1.4]) {
        for (const mirror of [false, true]) {
          for (const speed of [0.75, 1.3]) {
            for (const realisticJitter of [false, true]) {
              for (const dropout of [0, 0.05]) {
                const result = run(verb, verb, { seed, scale, mirror, speed, realisticJitter, dropout });
                if (!result.detected || result.t > 6000 || result.quality < 50) {
                  failures.push({ verb, seed, scale, mirror, speed, realisticJitter, dropout, result });
                }
              }
            }
          }
        }
      }
    }
  }
  const failureSummary = Object.fromEntries(ALL_VERBS.map((verb) => {
    const matching = failures.filter((failure) => failure.verb === verb);
    return [verb, { count: matching.length, example: matching[0] ?? null }];
  }).filter(([, value]) => value.count));
  assert.deepEqual(failureSummary, {});
});

test('realistic idle jitter, wrist spikes, and fidgeting remain negative', () => {
  const variants = [
    { name: 'gaussian jitter', realisticJitter: true },
    { name: 'single-frame wrist spikes', realisticJitter: true, wristSpikeRate: 0.01 },
    { name: 'brief face and hair fidgets', realisticJitter: true, idleVariant: 'fidget' }
  ];
  for (const variant of variants) {
    for (const verb of ALL_VERBS) {
      const result = run(verb, 'idle', { durationMs: 15000, fps: 20, seed: 7, dropout: 0.02, ...variant });
      assert.equal(result.detected, false, `${verb} detected ${variant.name} at ${result.t}ms`);
      if (verb === 'dance') assert.ok(result.evidence < 0.5, `dance ${variant.name} evidence was ${result.evidence}`);
    }
  }
});

test('climb recognises hand-over-hand reaches that stay above the shoulders', () => {
  const result = run('climb', 'climb', { climbVariant: 'above-shoulders', realisticJitter: true });
  assert.equal(result.detected, true);
  assert.ok(result.t <= 6000);
});

test('cross-recognition report', (context) => {
  const report = {};
  for (const motion of ALL_VERBS) {
    report[motion] = ALL_VERBS.filter((target) => run(target, motion, { durationMs: 6000, fps: 15, seed: 11 }).detected);
  }
  context.diagnostic(`cross-recognition: ${JSON.stringify(report)}`);
});
