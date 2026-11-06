import { AppError, fail } from '../errors.js';
import { send } from '../network.js';
import { eligibility } from '../filters.js';
export function normalizeThing(thing) {
  const data = thing?.data;
  if (!data || !['t1', 't3'].includes(thing.kind) || !/^t[13]_[a-z0-9]+$/.test(data.name)) return null;
  const comment = thing.kind === 't1';
  const text = comment ? data.body : data.selftext;
  return {
    id: data.name, authorId: data.author_fullname || '', author: data.author || '', subreddit: data.subreddit || '',
    type: comment ? 'comment' : 'post', created: Number(data.created_utc) * 1000,
    text: typeof text === 'string' ? text : '', score: typeof data.score === 'number' ? data.score : null,
    edited: data.edited === false ? false : typeof data.edited === 'number' && data.edited > 0 ? true : null,
    editable: (comment || data.is_self === true) && !data.archived && !data.locked && !data.removed_by_category && !['[deleted]', '[removed]'].includes(text),
    deleted: data.author === '[deleted]' && text === '[deleted]', permalink: data.permalink || ''
  };
}
export class RedditAdapter {
  simulation = false;
  handlesScheduling = true;
  label = 'Reddit OAuth';
  constructor({ auth, scheduler, transport = send, version = '0.2.0' }) { Object.assign(this, { auth, scheduler, transport, version }); }
  async raw(path, { method = 'GET', body, signal, beforeDispatch } = {}) {
    const token = this.auth.token();
    beforeDispatch?.();
    const response = await this.transport({ url: `https://oauth.reddit.com${path}`, method, headers: { Authorization: `Bearer ${token}`, 'User-Agent': `web:Wipeditt:v${this.version} (https://github.com/rafelolv/Wipeditt)`, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, ...(body ? { body: new URLSearchParams(body).toString() } : {}) }, { signal });
    const headers = new Headers(response.headers);
    if (response.status !== 200) throw new AppError('HTTP', `Reddit refused the request (HTTP ${response.status}).`, { status: response.status, headers });
    let data;
    try { data = JSON.parse(response.text); } catch { fail('RESPONSE', 'Reddit returned an unreadable response.'); }
    const errors = data?.json?.errors;
    if (Array.isArray(errors) && errors.length) {
      const rate = errors.find(error => error[0] === 'RATELIMIT');
      if (rate) {
        const match = /(?:try again in|wait)\s+(\d+(?:\.\d+)?)\s*(second|minute|hour)/i.exec(String(rate[1]));
        const retryAfterMs = match ? Number(match[1]) * ({ second: 1000, minute: 60000, hour: 3600000 }[match[2].toLowerCase()]) : 60000;
        throw new AppError('RATELIMIT', 'Reddit asked Wipeditt to wait.', { headers, retryAfterMs });
      }
      const code = ['USER_REQUIRED', 'WRONG_USER', 'NOT_AUTHOR'].includes(errors[0]?.[0]) ? 'AUTH' : 'REDDIT_REJECTED';
      throw new AppError(code, 'Reddit rejected the content change. It may be locked, restricted or no longer editable.', { status: code === 'AUTH' ? 403 : 400, headers });
    }
    return { data, headers };
  }
  async identityRaw(signal, expected) {
    const result = await this.raw('/api/v1/me?raw_json=1', { signal });
    const { id, name } = result.data;
    if (typeof id !== 'string' || !/^[a-z0-9]+$/.test(id) || typeof name !== 'string' || !name) fail('AUTH', 'Reddit account identity could not be verified.');
    const identity = { id: `t2_${id}`, name };
    if (expected && (identity.id !== expected.id || identity.name !== expected.name)) fail('ACCOUNT_CHANGED', 'Reddit account changed. Scan again.');
    return { data: identity, headers: result.headers };
  }
  account({ signal } = {}) { return this.scheduler.request(() => this.identityRaw(signal), { signal }); }
  async page({ account, after, type, signal }) {
    if (!/^[A-Za-z0-9_-]+$/.test(account.name)) fail('AUTH', 'Invalid Reddit account name.');
    const listing = type === 'comment' ? 'comments' : type === 'post' ? 'submitted' : 'overview';
    const query = new URLSearchParams({ limit: '100', sort: 'new', raw_json: '1', ...(after ? { after } : {}) });
    const data = await this.scheduler.request(() => this.raw(`/user/${account.name}/${listing}?${query}`, { signal }), { signal });
    if (data?.kind !== 'Listing' || !Array.isArray(data.data?.children)) fail('RESPONSE', 'Reddit returned an invalid history listing.');
    if (data.data.after !== null && typeof data.data.after !== 'string') fail('RESPONSE', 'Reddit returned an invalid history cursor.');
    return { items: data.data.children.map(normalizeThing).filter(Boolean), after: data.data.after };
  }
  async thingRaw(id, signal) {
    if (!/^t[13]_[a-z0-9]+$/.test(id)) fail('OWNERSHIP', 'Invalid Reddit content ID.');
    const result = await this.raw(`/api/info?${new URLSearchParams({ id, raw_json: '1' })}`, { signal });
    if (!Array.isArray(result.data?.data?.children)) fail('RESPONSE', 'Reddit did not return content for verification.');
    return { data: result.data.data.children.map(normalizeThing).find(item => item?.id === id) || null, headers: result.headers };
  }
  get(id, { signal } = {}) { return this.scheduler.request(() => this.thingRaw(id, signal), { signal }); }
  edit(id, text, expected, { signal, beforeDispatch } = {}) {
    if (typeof text !== 'string' || !text.trim() || text.length > 10000) fail('FILTER', 'Invalid replacement text.');
    return this.scheduler.request(() => this.raw('/api/editusertext', { method: 'POST', body: { thing_id: id, text, api_type: 'json', return_rtjson: 'false' }, signal, beforeDispatch }), {
      signal, write: true,
      before: [() => this.identityRaw(signal, expected), async () => {
        const result = await this.thingRaw(id, signal);
        if (!result.data || eligibility(result.data, expected, 'anonymize')) fail('OWNERSHIP', 'Reddit ownership or edit permission changed.');
        return result;
      }]
    });
  }
  delete() { fail('DELETION_UNVERIFIED', 'Live deletion will be enabled after real-account anonymization and deletion validation.'); }
}
