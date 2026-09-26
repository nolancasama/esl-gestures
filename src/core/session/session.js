import { DEFAULT_POOL } from '../../config/vocab.js';
import { TIMING } from '../../config/timing.js';

function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const text = String(seed ?? 'esl-gestures');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed) {
  let value = hashSeed(seed);
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, rng) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function uniquePool(pool) {
  return [...new Set(pool)].filter((verb) => typeof verb === 'string' && verb.length > 0);
}

export function neededHelp(record, wrongFirst = false) {
  return Boolean(record && (
    record.maxStage >= 2 || record.skipped || record.watched || wrongFirst || record.wrongFirst
  ));
}

export function isStreakSuccess(record, wrongFirst = false) {
  return Boolean(record
    && record.recognised
    && !record.skipped
    && !record.teacherPass
    && !record.watched
    && record.maxStage <= 1
    && !wrongFirst
    && !record.wrongFirst);
}

export function createItemRecord(verb, recycled = false, outcome = {}) {
  const teacherPass = Boolean(outcome.teacherPass);
  const skipped = Boolean(outcome.skipped);
  const recognised = !skipped && (teacherPass || Boolean(outcome.recognised ?? outcome.recognized));
  const quality = recognised && !teacherPass && Number.isFinite(outcome.quality)
    ? Math.max(0, Math.min(100, outcome.quality))
    : null;

  return {
    verb,
    recycled: Boolean(recycled),
    recognised,
    teacherPass,
    skipped,
    maxStage: Math.max(0, Math.min(3, Math.trunc(outcome.maxStage ?? 0))),
    quality,
    timeMs: Math.max(0, Number(outcome.timeMs) || 0),
    watched: Boolean(outcome.watched)
  };
}

function normaliseNeededHelp(values, allowed) {
  const result = [];
  for (const value of values ?? []) {
    const verb = typeof value === 'string' ? value : value?.verb;
    if (allowed.has(verb) && !result.includes(verb)) result.push(verb);
  }
  return result;
}

export class SessionManager {
  constructor({
    pool = DEFAULT_POOL,
    roundSize = TIMING.roundSize,
    rng,
    seed,
    priorNeededHelp = [],
    previousRecords
  } = {}) {
    this.pool = uniquePool(pool);
    if (this.pool.length < roundSize) {
      throw new RangeError(`roundSize ${roundSize} exceeds the ${this.pool.length} distinct verbs in the pool`);
    }
    this.roundSize = roundSize;
    this.rng = typeof rng === 'function' ? rng : createSeededRng(seed);
    const previousHelp = previousRecords
      ? previousRecords.filter((record) => neededHelp(record)).map(({ verb }) => verb)
      : priorNeededHelp;
    this.previousNeededHelp = normaliseNeededHelp(previousHelp, new Set(this.pool));
    this.startRound();
  }

  startRound({ priorNeededHelp = this.previousNeededHelp } = {}) {
    const allowed = new Set(this.pool);
    const helpFirst = normaliseNeededHelp(priorNeededHelp, allowed).slice(0, this.roundSize);
    const rest = shuffle(this.pool.filter((verb) => !helpFirst.includes(verb)), this.rng);
    const verbs = [...helpFirst, ...rest].slice(0, this.roundSize);

    this.baseVerbs = verbs;
    this.items = verbs.map((verb) => ({ verb, recycled: false }));
    this.records = [];
    this.index = 0;
    this.recycledVerbs = new Set();
    this.recycledCount = 0;
    this.helpVerbs = new Set();
    this.currentStreak = 0;
    this.bestStreak = 0;
    return this.current();
  }

  current() {
    const item = this.items[this.index];
    return item ? { ...item } : null;
  }

  get done() {
    return this.index >= this.items.length;
  }

  get queue() {
    return this.items.map((item) => ({ ...item }));
  }

  complete(outcome = {}) {
    const item = this.items[this.index];
    if (!item) throw new Error('There is no current item to complete');

    const record = createItemRecord(item.verb, item.recycled, outcome);
    const requiresHelp = neededHelp(record, Boolean(outcome.wrongFirst));
    this.records.push(record);
    if (requiresHelp) this.helpVerbs.add(item.verb);

    if (isStreakSuccess(record, Boolean(outcome.wrongFirst))) {
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = 0;
    }

    let recycledItem = null;
    const remaining = this.items.length - this.index - 1;
    const canRecycle = requiresHelp
      && !item.recycled
      && !this.recycledVerbs.has(item.verb)
      && this.recycledCount < TIMING.maxRecycledItems
      && remaining > 0;

    if (canRecycle) {
      const range = TIMING.recycleMaxGap - TIMING.recycleMinGap + 1;
      const gap = TIMING.recycleMinGap + Math.floor(this.rng() * range);
      const insertionIndex = Math.min(this.items.length, this.index + gap);
      recycledItem = { verb: item.verb, recycled: true };
      this.items.splice(insertionIndex, 0, recycledItem);
      this.recycledVerbs.add(item.verb);
      this.recycledCount += 1;
    }

    this.index += 1;
    if (this.done) this.previousNeededHelp = [...this.helpVerbs];

    return {
      record: { ...record },
      recycledItem: recycledItem ? { ...recycledItem } : null,
      next: this.current(),
      done: this.done,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak
    };
  }

  completeItem(outcome = {}) {
    return this.complete(outcome);
  }

  summary() {
    const byVerb = new Map(this.baseVerbs.map((verb) => [verb, {
      verb,
      recognised: false,
      teacherPass: false,
      skipped: false,
      quality: null,
      attempts: 0
    }]));

    for (const record of this.records) {
      const result = byVerb.get(record.verb);
      if (!result) continue;
      result.recognised ||= record.recognised;
      result.teacherPass ||= record.teacherPass;
      result.skipped ||= record.skipped;
      result.attempts += 1;
      if (record.quality != null) result.quality = Math.max(result.quality ?? 0, record.quality);
    }

    return {
      wordCount: this.baseVerbs.length,
      itemCount: this.records.length,
      recognisedCount: [...byVerb.values()].filter(({ recognised }) => recognised).length,
      teacherPassCount: this.records.filter(({ teacherPass }) => teacherPass).length,
      skippedCount: this.records.filter(({ skipped }) => skipped).length,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      neededHelp: [...this.helpVerbs],
      verbs: [...byVerb.values()].map((value) => ({ ...value })),
      records: this.records.map((record) => ({ ...record }))
    };
  }
}

export function createSession(options) {
  return new SessionManager(options);
}
