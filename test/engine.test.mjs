import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, item, run } from './helpers.mjs';
import { AppError } from '../src/errors.js';

test('scan deduplicates and distinguishes inspected, unique, matching and eligible', async () => {
  const { engine, adapter } = setup();
  let calls = 0;
  adapter.page = async () => (++calls === 1 ? { items: [item(), item(), item({ id: 't1_other', editable: false })], after: 'next' } : { items: [item({ id: 't1_third', authorId: 't2_other' })], after: null });
  const preview = await engine.scan({});
  assert.deepEqual(preview.stats, { inspected: 4, unique: 3, matched: 3, eligible: 1 });
  assert.equal(preview.completeHistory, false);
  assert.equal(calls, 2);
});
test('pagination cursor loop, safety cap and item limit cannot imply complete history', async () => {
  const { engine, adapter } = setup();
  let n = 0;
  adapter.page = async () => ({ items: [item({ id: `t1_a${n++}` })], after: 'loop' });
  assert.match((await engine.scan({ limit: 0 })).reason, /Repeated/);
  assert.equal(n, 2);
  assert.match((await engine.scan({ limit: 1 })).reason, /limit reached/);
});
test('custom replacement verified; matching text avoids extra edit', async () => {
  const { engine, adapter } = setup();
  let edits = 0;
  const edit = adapter.edit.bind(adapter);
  adapter.edit = async (...args) => { edits++; return edit(...args); };
  const first = await run(engine, { replacement: 'My custom privacy text' });
  assert.equal(first.records[0].state, 'anonymized');
  assert.equal(adapter.items[0].text, 'My custom privacy text');
  await run(engine, { replacement: 'My custom privacy text' });
  assert.equal(edits, 1);
});
test('delete and combined mode verify final state and honor delay', async () => {
  for (const mode of ['delete', 'combined']) {
    const { engine, adapter, now } = setup();
    const start = now();
    const result = await run(engine, { mode, deleteDelay: 5000 });
    assert.equal(result.records[0].state, 'deleted');
    assert.equal(adapter.items[0].text, '');
    if (mode === 'combined') assert.ok(now() - start >= 5000);
  }
});
test('combined mode never deletes after rejected or unverified edits', async () => {
  for (const behavior of ['reject', 'ignore']) {
    const { engine, adapter } = setup();
    adapter.edit = async () => { if (behavior === 'reject') throw new AppError('EDIT', 'Rejected', { status: 400 }); return { acknowledged: true }; };
    let deleted = false;
    adapter.delete = async () => { deleted = true; };
    const result = await run(engine, { mode: 'combined' });
    assert.equal(deleted, false);
    assert.equal(result.records[0].state, behavior === 'reject' ? 'failed' : 'uncertain');
  }
});
test('submitted write network timeout is uncertain with no replay', async () => {
  const { engine, adapter } = setup();
  let calls = 0;
  adapter.edit = async () => { calls++; throw new AppError('TIMEOUT', 'Timed out'); };
  const result = await run(engine);
  assert.equal(result.records[0].state, 'uncertain');
  assert.equal(calls, 1);
});
test('verification network failures stay uncertain after successful write', async () => {
  const { engine, adapter } = setup();
  const edit = adapter.edit.bind(adapter);
  adapter.edit = async (...args) => { await edit(...args); adapter.get = async () => { throw new AppError('NETWORK', 'Offline'); }; };
  assert.equal((await run(engine)).records[0].state, 'uncertain');
});
test('partial completion includes deletion failures and continues safely', async () => {
  const { engine, adapter } = setup([item(), item({ id: 't1_second' })]);
  const del = adapter.delete.bind(adapter);
  adapter.delete = async (id, ...rest) => { if (id === 't1_second') throw new AppError('DELETE', 'Rejected', { status: 400 }); return del(id, ...rest); };
  const result = await run(engine, { mode: 'delete' });
  assert.deepEqual(result.records.map(r => r.state), ['deleted', 'failed']);
});
test('ownership changes and account changes stop subsequent writes', async () => {
  for (const change of ['account', 'owner']) {
    const { engine, adapter } = setup();
    await engine.scan({});
    engine.confirmationFor({});
    if (change === 'account') adapter.identity = { id: 't2_other', name: 'other' };
    else adapter.items[0].authorId = 't2_other';
    const result = await engine.execute({}, { confirmed: true });
    assert.notEqual(result.records[0].state, 'anonymized');
    assert.notEqual(adapter.items[0].text, result.options.replacement);
  }
});
test('account change while scheduler waits is caught by adapter dispatch guard', async () => {
  const { engine, adapter, scheduler } = setup();
  const request = scheduler.request.bind(scheduler);
  scheduler.request = (task, settings) => request(settings?.write ? () => { adapter.identity.id = 't2_other'; return task(); } : task, settings);
  assert.equal((await run(engine)).records[0].code, 'ACCOUNT_CHANGED');
});
test('settings, selection, expiry, explicit acceptance and dialog cancellation invalidate confirmation', async () => {
  for (const change of ['mode', 'replacement', 'include', 'delay', 'selection', 'expiry', 'cancel', 'acceptance', 'revision']) {
    const { engine, advance } = setup();
    const options = {};
    await engine.scan(options); engine.confirmationFor(options);
    if (change === 'mode') options.mode = 'delete';
    if (change === 'replacement') options.replacement = 'different';
    if (change === 'include') options.include = 'different';
    if (change === 'delay') options.deleteDelay = 1000;
    if (change === 'selection') { engine.select(item().id, false); engine.select(item().id, true); }
    if (change === 'expiry') advance(300001);
    if (change === 'cancel') engine.cancelConfirmation();
    if (change === 'revision') engine.invalidate();
    await assert.rejects(engine.execute(options, { confirmed: change !== 'acceptance' }));
  }
});
test('more than 100 selected items require exact typed phrase', async () => {
  const { engine } = setup(Array.from({ length: 101 }, (_, n) => item({ id: `t1_i${n}` })));
  await engine.scan({ limit: 0 });
  assert.equal(engine.confirmationFor({ limit: 0 }).phrase, 'ANONYMIZE');
  await assert.rejects(engine.execute({ limit: 0 }, { confirmed: true, phrase: 'anonymize' }), { code: 'CONFIRM' });
});
test('stop prevents subsequent writes and interrupted submitted writes remain uncertain', async () => {
  const controller = new AbortController();
  const { engine, adapter } = setup([item(), item({ id: 't1_second' })]);
  const edit = adapter.edit.bind(adapter);
  let calls = 0;
  adapter.edit = async (...args) => { calls++; await edit(...args); controller.abort(); };
  const result = await run(engine, {}, { signal: controller.signal });
  assert.equal(calls, 1);
  assert.equal(result.stopped, true);
  assert.equal(result.records[0].state, 'uncertain');
});
test('cancellation during scan leaves no executable preview', async () => {
  const controller = new AbortController();
  const { engine, adapter } = setup();
  adapter.page = async () => { controller.abort(); return { items: [item()], after: 'next' }; };
  await assert.rejects(engine.scan({}, controller.signal), { code: 'STOPPED' });
  assert.equal(engine.preview, null);
});
test('filter changes during scan prevent stale preview', async () => {
  const { engine, adapter } = setup();
  const page = adapter.page.bind(adapter);
  adapter.page = async (...args) => { engine.invalidate(); return page(...args); };
  await assert.rejects(engine.scan({}), { code: 'STALE' });
});
test('hard page cap terminates continually changing cursors', async () => {
  const { engine, adapter } = setup();
  let pages = 0;
  adapter.page = async () => ({ items: [item({ id: `t1_page${pages++}` })], after: `cursor${pages}` });
  const preview = await engine.scan({ limit: 0 });
  assert.equal(pages, 1000);
  assert.match(preview.reason, /Page safety limit/);
});
test('combined-mode dispatch refuses deletion if text changes during its final cooldown', async () => {
  const { engine, adapter, scheduler } = setup();
  const request = scheduler.request.bind(scheduler);
  let writes = 0;
  scheduler.request = (task, settings) => request(settings?.write ? () => {
    if (++writes === 2) adapter.items[0].text = 'New text after review';
    return task();
  } : task, settings);
  const result = await run(engine, { mode: 'combined' });
  assert.equal(adapter.items[0].deleted, false);
  assert.equal(result.records[0].code, 'EDIT_CHANGED');
  assert.equal(result.records[0].state, 'uncertain');
});
test('replacement changes reuse scanned data but invalidate the previous confirmation', async () => {
  const { engine, adapter } = setup();
  await engine.scan({}); engine.confirmationFor({});
  let pages = 0;
  adapter.page = async () => { pages++; throw new Error('Unexpected scan'); };
  const preview = engine.updateOperation({ replacement: 'Fresh replacement' });
  assert.equal(preview.items.length, 1);
  await assert.rejects(engine.execute({ replacement: 'Fresh replacement' }, { confirmed: true }), { code: 'CONFIRM' });
  engine.confirmationFor({ replacement: 'Fresh replacement' });
  const result = await engine.execute({ replacement: 'Fresh replacement' }, { confirmed: true });
  assert.equal(result.records[0].state, 'anonymized');
  assert.equal(pages, 0);
});
test('operation-only updates cannot extend preview lifetime or reuse changed filters', async () => {
  const { engine, advance } = setup();
  await engine.scan({}); advance(300001);
  engine.updateOperation({ replacement: 'Fresh replacement' });
  assert.throws(() => engine.confirmationFor({ replacement: 'Fresh replacement' }), { code: 'STALE' });
  await engine.scan({});
  assert.throws(() => engine.updateOperation({ contains: 'different' }), { code: 'STALE' });
});

test('imported comments use the same filters, ownership checks and confirmation path', async () => {
  const { engine, adapter } = setup([item({ id: 't1_imported' })]);
  const imported = [
    item({ id: 't1_imported', text: 'Imported synthetic comment' }),
    item({ id: 't1_foreign', authorId: 't2_other', author: 'other', text: 'Imported foreign comment' }),
    item({ id: 't1_imported', text: 'Duplicate row' })
  ];
  const preview = await engine.import(imported, { type: 'comment', contains: 'imported' });
  assert.equal(preview.source, 'import');
  assert.deepEqual(preview.stats, { inspected: 3, unique: 2, matched: 2, eligible: 1 });
  assert.match(preview.reason, /Imported 3 rows/);
  const confirmation = engine.confirmationFor({ type: 'comment', contains: 'imported' });
  assert.equal(confirmation.count, 1);
  const result = await engine.execute({ type: 'comment', contains: 'imported' }, { confirmed: true, phrase: confirmation.phrase });
  assert.equal(result.records[0].state, 'anonymized');
  assert.equal(result.source, 'import');
  assert.equal(adapter.items[0].text, 'This content has been removed for privacy reasons.');
});
