import test from 'node:test';
import assert from 'node:assert/strict';
import { rate } from './quality.js';

test('rating bands cover every detection quality', () => {
  assert.deepEqual(rate(50), { quality: 50, label: 'GOOD!', stars: 1, band: 'GOOD' });
  assert.equal(rate(69).stars, 1);
  assert.equal(rate(70).label, 'GREAT!');
  assert.equal(rate(89).stars, 2);
  assert.equal(rate(90).label, 'PERFECT!');
  assert.equal(rate(100).stars, 3);
  assert.equal(rate(20).quality, 50);
  assert.equal(rate(120).quality, 100);
});
