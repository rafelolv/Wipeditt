import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptions, makeMatcher, eligibility } from '../src/filters.js';
import { item } from './helpers.mjs';

test('filters match inclusive dates, subreddit lists, text, regex, scores and edited status', () => {
  const content = item({ created: Date.parse('2025-02-05T12:00:00Z'), score: 5, edited: true });
  const matches = makeMatcher(normalizeOptions({ include: 'r/TECHNOLOGY, privacy', exclude: 'cats', after: '2025-02-05T12:00:00Z', before: '2025-02-06T00:00:00Z', contains: 'SYNTHETIC', regex: 'example', minScore: 5, maxScore: 5, edited: 'yes', type: 'comment' }));
  assert.equal(matches(content), true);
  for (const changes of [{ subreddit: 'cats' }, { created: content.created - 1 }, { score: 6 }, { score: null }, { edited: false }, { type: 'post' }, { text: 'other' }]) assert.equal(matches({ ...content, ...changes }), false);
});
test('invalid regex, dates, bounds, counts, score and replacement rejected', () => {
  for (const options of [{ regex: '[' }, { after: 'nonsense' }, { after: '2025-02-30' }, { after: '2025-01-02', before: '2025-01-01' }, { minScore: 2, maxScore: 1 }, { limit: 1.5 }, { limit: -1 }, { interval: 0 }, { replacement: ' ' }, { replacement: 'x'.repeat(10001) }, { mode: 'other' }]) assert.throws(() => normalizeOptions(options), { code: 'FILTER' });
});
test('ownership, IDs and editable capabilities fail closed', () => {
  const account = { id: 't2_demo', name: 'demo_user' };
  assert.equal(eligibility(item(), account, 'anonymize'), '');
  for (const changes of [{ authorId: 't2_other' }, { author: 'other' }, { id: '<script>' }, { editable: false }, { deleted: true }]) assert.ok(eligibility(item(changes), account, 'anonymize'));
  assert.equal(eligibility(item({ editable: false }), account, 'delete'), '');
});
