// Install an entirely local HTTPS fixture handler into Wipeditt's own session.
// The app still navigates native pages and clicks native edit/save controls.
export async function installFixture(application) {
  await application.evaluate(({ session }) => {
    globalThis.fixture = {
      signedIn: false, username: 'fixture_user', writes: [], navigations: [], failWrite: false,
      items: {
        t1_abc: { id: 't1_abc', author: 'fixture_user', text: 'A synthetic comment. Wipeditt should change only selected own content.', type: 'comment', dataAuthor: false },
        t1_other: { id: 't1_other', author: 'another_user', text: 'Someone else wrote this fixture. Never edit it.', type: 'comment' },
        t1_next: { id: 't1_next', author: 'fixture_user', text: 'An older synthetic comment on the next page.', type: 'comment', authorLink: false },
        t3_post: { id: 't3_post', author: 'fixture_user', text: 'A synthetic editable text-post body.', type: 'post' }
      }
    };
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const permalink = item => item.type === 'post' ? '/r/privacy/comments/post/fixture/' : `/r/privacy/comments/post/fixture/${item.id.slice(3)}/`;
    const itemHTML = item => {
      const author = escape(item.author);
      const declared = item.dataAuthor === false ? '' : ` data-author="${author}"`;
      const profile = item.authorLink === false
        ? `<span class="author">${author}</span>`
        : `<a class="author" href="https://old.reddit.com/user/${author}/">${author}</a>`;
      return `<div class="thing ${item.type === 'post' ? 'link self' : 'comment'}" data-fullname="${item.id}"${declared} data-subreddit="privacy" data-score="8"><div class="entry"><p class="tagline">${profile} · <time datetime="2024-06-01T12:00:00Z">a while ago</time><span class="score" title="8">8 points</span><a class="subreddit" href="/r/privacy/">r/privacy</a></p><form class="usertext"><div class="usertext-body"><div class="md">${escape(item.text)}</div></div><div class="usertext-edit" style="display:none"><textarea name="text">${escape(item.text)}</textarea><button type="submit" class="save">save</button><p class="error" style="display:none"></p></div></form><ul class="flat-list buttons"><li><a class="bylink" href="${permalink(item)}">permalink</a></li>${item.author === globalThis.fixture.username ? '<li><a class="edit-usertext" href="#">edit</a></li>' : ''}</ul></div></div>`;
    };
    const page = body => `<!doctype html><html><head><meta charset="utf-8"><title>Reddit native UI fixture</title><style>body{font:14px system-ui;background:#fff;color:#202020;padding:18px}.thing{padding:15px;border-bottom:1px solid #ccc}.buttons{display:flex;gap:20px}.usertext-edit textarea{display:block;width:500px;height:100px}#header-bottom-right{text-align:right}.error{color:#a00}</style></head><body><div id="header-bottom-right"><span class="user">${globalThis.fixture.signedIn ? `<a href="https://old.reddit.com/user/${globalThis.fixture.username}/">${globalThis.fixture.username}</a>` : '<a href="https://www.reddit.com/login/">log in</a>'}</span></div>${body}<script>document.querySelectorAll('.edit-usertext').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();const node=button.closest('.thing');node.querySelector('.usertext-edit').style.display='block';node.querySelector('.usertext-body').style.display='none';}));document.querySelectorAll('form.usertext').forEach(form=>form.addEventListener('submit',async event=>{event.preventDefault();const node=form.closest('.thing');const text=form.querySelector('textarea').value;const response=await fetch('/fixture-save',{method:'POST',body:new URLSearchParams({id:node.dataset.fullname,text})});if(!response.ok){const error=form.querySelector('.error');error.style.display='block';error.textContent='This edit was rejected.';return;}form.querySelector('.md').textContent=text;form.querySelector('.usertext-edit').style.display='none';form.querySelector('.usertext-body').style.display='block';}));document.querySelector('#fixture-login')?.addEventListener('click',async()=>{await fetch('/fixture-login',{method:'POST'});location.href='https://www.reddit.com/';});</script></body></html>`;
    const ownSession = session.fromPartition('wipeditt-reddit');
    ownSession.protocol.handle('https', async request => {
      const url = new URL(request.url);
      globalThis.fixture.navigations.push(url.pathname);
      if (!['www.reddit.com', 'old.reddit.com'].includes(url.hostname)) return new Response('Unexpected fixture host', { status: 403 });
      if (url.pathname === '/fixture-login') { globalThis.fixture.signedIn = true; return new Response('ok'); }
      if (url.pathname === '/fixture-save') {
        const body = new URLSearchParams(await request.text());
        const item = globalThis.fixture.items[body.get('id')];
        if (!item || item.author !== globalThis.fixture.username || globalThis.fixture.failWrite) return new Response('Rejected', { status: 403 });
        item.text = body.get('text');
        globalThis.fixture.writes.push({ id: item.id, text: item.text });
        return new Response('ok');
      }
      if (url.pathname.startsWith('/login') || !globalThis.fixture.signedIn) return new Response(page('<h1>Reddit login fixture</h1><p>Synthetic account only. No password is requested.</p><button id="fixture-login">Sign in to fixture account</button>'), { headers: { 'content-type': 'text/html' } });
      const comment = /^\/r\/privacy\/comments\/post\/fixture\/(abc|other|next)\//.exec(url.pathname);
      const post = url.pathname === '/r/privacy/comments/post/fixture/';
      let items;
      if (comment) items = [globalThis.fixture.items['t1_' + comment[1]]];
      else if (post || url.pathname.includes('/submitted')) items = [globalThis.fixture.items.t3_post];
      else if (url.searchParams.has('after')) items = [globalThis.fixture.items.t1_abc, globalThis.fixture.items.t1_next];
      else items = [globalThis.fixture.items.t1_abc, globalThis.fixture.items.t1_other];
      const next = !comment && !post && !url.searchParams.has('after') && !url.pathname.includes('/submitted') ? '<span class="next-button"><a href="https://old.reddit.com/user/fixture_user/comments/?after=t1_other">next</a></span>' : '';
      return new Response(page(`<div id="siteTable" class="sitetable linklisting">${items.map(itemHTML).join('')}</div>${next}`), { headers: { 'content-type': 'text/html' } });
    });
  });
}
