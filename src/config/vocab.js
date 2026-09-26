export const VOCAB = Object.freeze([
  { verb: 'jump', gloss: 'ジャンプする', group: 'body' },
  { verb: 'run', gloss: 'はしる', group: 'body' },
  { verb: 'walk', gloss: 'あるく', group: 'body' },
  { verb: 'dance', gloss: 'おどる', group: 'body' },
  { verb: 'swim', gloss: 'およぐ', group: 'body' },
  { verb: 'fly', gloss: 'そらをとぶ', group: 'body' },
  { verb: 'climb', gloss: 'のぼる', group: 'body' },
  { verb: 'catch', gloss: 'キャッチする', group: 'prop' },
  { verb: 'drink', gloss: 'のむ', group: 'prop' },
  { verb: 'eat', gloss: 'たべる', group: 'prop' },
  { verb: 'cut', gloss: 'きる', group: 'prop' },
  { verb: 'wash', gloss: 'あらう', group: 'body+fx' },
  { verb: 'stop', gloss: 'とまる', group: 'spare' }
].map(Object.freeze));

export const DEFAULT_POOL = Object.freeze(VOCAB.filter(({ verb }) => verb !== 'stop').map(({ verb }) => verb));
export const VOCAB_BY_VERB = Object.freeze(Object.fromEntries(VOCAB.map((entry) => [entry.verb, entry])));
