import assert from 'node:assert/strict';
import { redditPage } from '../../src/desktop/page.js';

export async function verifyAuthorLayouts(application) {
  const result = await application.evaluate(async ({ webContents, session }, driver) => {
    const remote = webContents.getAllWebContents().find(contents => contents.session === session.fromPartition('wipeditt-reddit'));
    const prepare = () => {
      const table = document.querySelector('#siteTable');
      const prototype = table.querySelector('.thing[data-fullname]').cloneNode(true);
      globalThis.authorTestOriginals = [...table.childNodes];
      const nodes = [];
      function candidate(id, mode) {
        const node = prototype.cloneNode(true);
        node.dataset.fullname = id;
        if (mode === 'archived') node.classList.add('archived', 'locked');
        delete node.dataset.author;
        node.querySelectorAll('.author').forEach(author => author.remove());
        const tagline = node.querySelector('.tagline');
        const author = document.createElement(mode === 'span' ? 'span' : 'a');
        author.className = 'author';
        author.textContent = mode === 'deleted' ? '[deleted]' : mode === 'foreign' ? 'another_user' : 'fixture_user';
        author.href = `https://old.reddit.com/user/${author.textContent}/`;
        if (mode === 'span') author.textContent = ' /u/Fixture_User ';
        if (mode === 'external') author.href = 'https://example.test/user/fixture_user/';
        if (mode === 'conflict') node.dataset.author = 'another_user';
        if (mode === 'deleted') author.removeAttribute('href');
        if (!['controls', 'unknown', 'nested'].includes(mode)) tagline.prepend(author);
        if (['unknown', 'nested'].includes(mode)) node.querySelector('.edit-usertext').remove();
        if (mode === 'nested') {
          const child = candidate('t1_child', 'foreign');
          node.append(child);
        }
        return node;
      }
      // Reproduce a batch where only one row has a profile link, while 64
      // own comments expose an ordinary author span instead.
      nodes.push(candidate('t1_link', 'link'));
      for (let index = 0; index < 64; index++) nodes.push(candidate(`t1_span${index}`, 'span'));
      for (const mode of ['archived', 'controls', 'foreign', 'unknown', 'nested', 'conflict', 'deleted', 'external']) nodes.push(candidate(`t1_${mode}`, mode));
      table.replaceChildren(...nodes);
    };
    await remote.executeJavaScript(`(${prepare.toString()})()`);
    try {
      return await remote.executeJavaScriptInIsolatedWorld(1001, [{ code: `(${driver})('listing', {expected:{id:'reddit:fixture_user',name:'fixture_user'}})` }]);
    } finally {
      await remote.executeJavaScript('document.querySelector("#siteTable").replaceChildren(...globalThis.authorTestOriginals); delete globalThis.authorTestOriginals;');
    }
  }, redditPage.toString());
  assert.ok(!result.error, JSON.stringify(result.error));
  const items = new Map(result.data.items.map(item => [item.id, item]));
  for (const id of ['t1_link', ...Array.from({ length: 64 }, (_, index) => `t1_span${index}`), 't1_controls', 't1_archived']) {
    assert.equal(items.get(id).authorId, 'reddit:fixture_user', `own author not resolved for ${id}`);
    assert.equal(items.get(id).editable, true);
  }
  assert.equal(items.has('t1_child'), false, 'nested context must not become an account history item');
  assert.equal(items.get('t1_controls').authorEvidence, 'own-edit-control');
  assert.equal(items.get('t1_foreign').authorId, 'reddit:another_user');
  for (const id of ['t1_unknown', 't1_nested', 't1_conflict', 't1_deleted', 't1_external']) assert.equal(items.get(id).authorId, '', `ambiguous author must remain blocked: ${id}`);
  console.log('Author regression passed: 65 own comments, native own edit controls, nested foreign authors, conflicts, missing metadata and invalid profile links.');
}
