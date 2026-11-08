import test from 'node:test';
import assert from 'node:assert/strict';
import { Checkpoints } from '../src/checkpoint.js';
import { makeReport } from '../src/report.js';
import { redditURL } from '../src/desktop/policy.js';
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
  for (const bad of ['javascript:alert(1)', 'https://evil.com/x', 'https://www.reddit.com.evil.com/', 'https://evil@www.reddit.com/', 'http://www.reddit.com/x']) assert.throws(() => redditURL(bad));
  assert.equal(redditURL('https://www.reddit.com/r/privacy/comments/example').hostname, 'www.reddit.com');
});

test('checkpoint retains only stage statuses and makes interrupted deletion uncertain', () => {
  const memory=new Map();
  const storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const checkpoints=new Checkpoints(storage);
  checkpoints.save([{id:'t1_stage',state:'deleting',steps:{anonymize:'verified',delete:'pending',text:'private original'},text:'secret',account:'private_name'}],false);
  const stored=[...memory.values()][0];
  assert.ok(!stored.includes('secret')&&!stored.includes('private'));
  const record=checkpoints.load().records[0];
  assert.equal(record.state,'uncertain');assert.deepEqual(record.steps,{anonymize:'verified',delete:'uncertain'});
});

test('only real verified deletions are remembered across imports, with expiry and no private data', async () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  let clock = 1000;
  let checkpoints = new Checkpoints(storage, () => clock);
  const verified = { id: item().id, state: 'deleted', steps: { anonymize: 'not-requested', delete: 'verified' }, text: 'private body', account: 'private owner' };
  checkpoints.save([verified], true);
  assert.equal(checkpoints.wasDeleted(verified.id, false), false);
  checkpoints.save([{ ...verified, state: 'uncertain', steps: { delete: 'uncertain' } }], false);
  assert.equal(checkpoints.wasDeleted(verified.id, false), false);
  checkpoints.save([verified], false);
  checkpoints.save([], false);
  checkpoints = new Checkpoints(storage, () => clock);
  assert.equal(checkpoints.wasDeleted(verified.id, false), true);
  assert.equal(checkpoints.wasDeleted(verified.id, true), false);
  assert.ok(![...memory.values()].join('').includes('private'));
  const { engine, adapter } = setup([item()], { checkpoints });
  adapter.simulation = false;
  let reads = 0;
  adapter.get = async () => { reads++; throw new Error('Excluded item must not be opened'); };
  assert.equal((await engine.import([item()], {})).items.length, 0);
  assert.equal(reads, 0);
  await engine.scan({});
  assert.equal(checkpoints.wasDeleted(verified.id, false), false, 'fresh live owned content overrides local history');
  checkpoints.save([verified], false);
  clock += 86400001;
  assert.equal(new Checkpoints(storage, () => clock).wasDeleted(verified.id, false), false);
  checkpoints.clear();
  assert.equal(memory.size, 0);
});

test('desktop checkpoint storage exposes pending writes before debounce flush', async () => {
  const { CheckpointStorage } = await import('../src/desktop/storage.js');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'wipeditt-checkpoint-'));
  try {
    const storage = new CheckpointStorage(join(directory, 'checkpoint.json'));
    const checkpoints = new Checkpoints(storage);
    checkpoints.save([{ id: 't1_saved', state: 'deleted', steps: { delete: 'verified' } }], false);
    assert.equal(new Checkpoints(storage).wasDeleted('t1_saved', false), true);
    checkpoints.forgetDeleted('t1_saved');
    assert.equal(JSON.parse(storage.getItem()).records[0].id, 't1_saved');
    storage.flush();
    assert.equal(new Checkpoints(storage).wasDeleted('t1_saved', false), false);
    storage.removeItem();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('legacy checkpoint migration remembers only independently verified real deletions', () => {
  const data = { expires: 10000, simulation: false, records: [
    { id: 't1_confirmed', state: 'deleted', steps: { delete: 'verified' } },
    { id: 't1_unproven', state: 'deleted' },
    { id: 't1_unknown', state: 'uncertain', steps: { delete: 'uncertain' } }
  ] };
  const storage = { getItem: () => JSON.stringify(data) };
  const checkpoints = new Checkpoints(storage, () => 1000);
  assert.equal(checkpoints.wasDeleted('t1_confirmed', false), true);
  assert.equal(checkpoints.wasDeleted('t1_unproven', false), false);
  assert.equal(checkpoints.wasDeleted('t1_unknown', false), false);
  data.simulation = true;
  assert.equal(new Checkpoints(storage, () => 1000).wasDeleted('t1_confirmed', false), false);
});
