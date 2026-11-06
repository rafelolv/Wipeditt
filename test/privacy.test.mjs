import test from 'node:test';
import assert from 'node:assert/strict';
import { Checkpoints } from '../src/checkpoint.js';
import { makeReport } from '../src/report.js';
import { safeLink } from '../src/ui/dom.js';
import { setup, item, run } from './helpers.mjs';

test('checkpoint recovery minimizes data, expires and never resumes pending writes', () => {
  const map = new Map();
  const storage = { setItem: (k, v) => map.set(k, v), getItem: k => map.get(k), removeItem: k => map.delete(k) };
  let time = 0;
  const checkpoints = new Checkpoints(storage, () => time);
  checkpoints.save([{ id: 't1_abc', state: 'editing', text: 'secret original' }, { id: 't1_xyz', state: 'deleted' }], true);
  assert.ok(![...map.values()][0].includes('secret'));
  assert.equal(checkpoints.load().records[0].state, 'uncertain');
  assert.equal(checkpoints.load().records[1].state, 'deleted');
  time += 86400001;
  assert.equal(checkpoints.load(), null);
  assert.equal(map.size, 0);
});
test('reports never contain original, replacement, account, subreddit or sensitive filter values', async () => {
  const { engine, scheduler } = setup([item({ text: 'secret original' })]);
  const result = await run(engine, { contains: 'secret original', replacement: 'secret replacement', include: 'technology' });
  const report = makeReport(result, '0.1.0', scheduler.stats);
  const json = JSON.stringify(report);
  for (const secret of ['secret original', 'secret replacement', 'technology', 'demo_user', 't2_demo']) assert.ok(!json.includes(secret));
  assert.equal(report.simulation, true);
  assert.equal(report.counts.anonymized, 1);
});
test('external or script links cannot be rendered as original content links', () => {
  for (const bad of ['javascript:alert(1)', 'https://evil.com/x', 'https://www.reddit.com.evil.com/', 'https://evil@www.reddit.com/', 'http://www.reddit.com/x']) assert.equal(safeLink(bad), null);
  assert.equal(safeLink('/r/privacy/comments/example'), 'https://www.reddit.com/r/privacy/comments/example');
});
