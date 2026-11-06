// HTTP fixtures for the real OAuth and Reddit transport paths. Never contact Reddit.
export function fixtureServer() {
  const calls = [];
  let edits = 0;
  const item = { kind: 't1', data: { name: 't1_abc', author: 'fixture_user', author_fullname: 't2_owner', subreddit: 'privacy', body: 'An original synthetic comment for the HTTP adapter test.', score: 8, edited: false, created_utc: 1700000000, permalink: '/r/privacy/comments/abc/example', archived: false, locked: false } };
  const foreign = { kind: 't1', data: { ...item.data, name: 't1_other', author: 'another_user', author_fullname: 't2_other', body: 'Not yours. Wipeditt must never modify this fixture.' } };
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-expose-headers': 'x-ratelimit-remaining', 'x-ratelimit-remaining': '900' };
  const route = async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ path: url.pathname, method: request.method(), origin: url.origin });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/api/v1/authorize') {
      if (url.searchParams.get('client_id') !== 'fixture-client-id') throw new Error('Unexpected fixture Client ID');
      const callback = new URL(url.searchParams.get('redirect_uri'));
      callback.search = new URLSearchParams({ code: 'fixture-code', state: url.searchParams.get('state') });
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Mock Reddit consent</title><script>location.replace(${JSON.stringify(callback.href)})</script>` });
    }
    if (url.pathname === '/api/v1/access_token') return route.fulfill({ contentType: 'application/json', headers, body: JSON.stringify({ access_token: 'fixture-token', token_type: 'bearer', scope: 'identity history read edit', expires_in: 3600 }) });
    if (url.origin === 'https://oauth.reddit.com') {
      let data;
      if (url.pathname === '/api/v1/me') data = { id: 'owner', name: 'fixture_user' };
      else if (/\/user\/fixture_user\/(comments|overview|submitted)$/.test(url.pathname)) data = { kind: 'Listing', data: { children: [item, foreign], after: null } };
      else if (url.pathname === '/api/info') data = { kind: 'Listing', data: { children: [item] } };
      else if (url.pathname === '/api/editusertext') {
        const body = new URLSearchParams(request.postData());
        if (body.get('thing_id') !== 't1_abc') throw new Error('Fixture attempted foreign edit');
        item.data.body = body.get('text'); item.data.edited = 1700000001; edits++;
        data = { json: { errors: [] } };
      } else throw new Error('Unexpected fixture API route: ' + url.pathname);
      return route.fulfill({ contentType: 'application/json', headers, body: JSON.stringify(data) });
    }
    if (url.origin === 'https://www.reddit.com' && request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated Reddit fixture</title><style>body{background:#101512}button{font-size:80px!important}</style>' });
    return route.abort();
  };
  return { route, calls, edits: () => edits, item };
}
