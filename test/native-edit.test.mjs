import test from 'node:test';
import assert from 'node:assert/strict';
import { RedditBrowser } from '../src/desktop/reddit-browser.js';
import { AppError } from '../src/errors.js';
import { setup, item } from './helpers.mjs';

function nativeEdit({ saved = true, delayed = false, settled = true, requestFailure = null } = {}) {
  const { scheduler } = setup();
  let writes = 0, reads = 0, observed = 0;
  const text = 'Anonymized.\n\n[Wipeditt](https://github.com/rafelolv/Wipeditt)';
  const browser = new RedditBrowser({ contents: {}, scheduler, now: scheduler.now, sleeper: scheduler.sleeper, writeTracker: {
    begin: () => ({}), end() {}, wait: async () => { observed++; if (requestFailure) throw requestFailure; }
  } });
  browser.getRaw = async () => { reads++; return item({ text: saved && reads > (delayed ? 3 : 1) ? text : 'Original content' }); };
  browser.dom = async operation => { if (operation === 'submit-edit') writes++; return { settled }; };
  return { browser, text, writes: () => writes, reads: () => reads, observed: () => observed };
}

test('native edit verifies raw Markdown after request completion and fresh propagation reads', async () => {
  const fixture = nativeEdit({ delayed: true });
  await fixture.browser.edit(item().id, fixture.text, {});
  assert.equal(fixture.writes(), 1); assert.equal(fixture.observed(), 1); assert.equal(fixture.reads(), 4);
});

test('stale editor UI cannot override independently verified saved source', async () => {
  const fixture = nativeEdit({ settled: false });
  await fixture.browser.edit(item().id, fixture.text, {});
  assert.equal(fixture.writes(), 1); assert.equal(fixture.reads(), 2);
});

test('a submitted edit with unchanged fresh source stays uncertain without replay', async () => {
  const fixture = nativeEdit({ saved: false });
  await assert.rejects(fixture.browser.edit(item().id, fixture.text, {}), { code: 'UNCERTAIN', reason: 'EDIT_SOURCE_MISMATCH' });
  assert.equal(fixture.writes(), 1); assert.equal(fixture.reads(), 4);
});

test('an unconfirmed native edit request stops before verification or another write', async () => {
  const fixture = nativeEdit({ requestFailure: new AppError('UNCERTAIN', 'Unknown native result', { fatal: true }) });
  await assert.rejects(fixture.browser.edit(item().id, fixture.text, {}), { code: 'UNCERTAIN' });
  assert.equal(fixture.writes(), 1); assert.equal(fixture.reads(), 1);
});
