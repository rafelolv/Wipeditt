import { fail } from './errors.js';
export const DEFAULT_REPLACEMENT = 'This content has been removed for privacy reasons.';
const list = value => [...new Set(String(value || '').split(/[\s,]+/).filter(Boolean).map(s => s.replace(/^r\//i, '').toLowerCase()))].sort();
function date(value) {
  if (!value) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(String(value));
  if (!parts) fail('FILTER', 'Enter an ISO date or date and time.');
  const [year, month, day] = parts.slice(1).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) fail('FILTER', 'Enter a valid calendar date.');
  const n = Date.parse(value);
  if (!Number.isFinite(n)) fail('FILTER', 'Enter a valid date and time.');
  return n;
}
function number(value, fallback = null) {
  if (value === '' || value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) fail('FILTER', 'Enter a finite numeric value.');
  return n;
}
export function normalizeOptions(raw = {}) {
  const o = {
    type: raw.type || 'all', include: list(raw.include), exclude: list(raw.exclude),
    after: date(raw.after), before: date(raw.before), contains: String(raw.contains || ''),
    regex: String(raw.regex || ''), minScore: number(raw.minScore), maxScore: number(raw.maxScore),
    edited: raw.edited || 'all', limit: number(raw.limit, 100),
    mode: raw.mode || 'anonymize', replacement: raw.replacement ?? DEFAULT_REPLACEMENT,
    interval: number(raw.interval, 1500), deleteDelay: number(raw.deleteDelay, 0)
  };
  if (!['all', 'comment', 'post'].includes(o.type) || !['all', 'yes', 'no'].includes(o.edited) || !['anonymize', 'delete', 'combined'].includes(o.mode)) fail('FILTER', 'Invalid operation or content type.');
  if (o.after !== null && o.before !== null && o.after >= o.before) fail('FILTER', 'Start date must precede end date.');
  if (o.minScore !== null && o.maxScore !== null && o.minScore > o.maxScore) fail('FILTER', 'Minimum score must not exceed maximum score.');
  if (!Number.isInteger(o.limit) || o.limit < 0 || o.limit > 100000) fail('FILTER', 'Item limit must be a whole number from 0 to 100000.');
  if (o.interval < 1500 || o.interval > 3600000 || o.deleteDelay < 0 || o.deleteDelay > 86400000) fail('FILTER', 'Interval must be 1500–3600000 ms; deletion delay 0–86400000 ms.');
  if (typeof o.replacement !== 'string' || !o.replacement.trim() || o.replacement.length > 10000) fail('FILTER', 'Replacement must contain 1–10000 characters.');
  if (o.regex.length > 300) fail('FILTER', 'Regex is limited to 300 characters.');
  try { if (o.regex) new RegExp(o.regex, 'iu'); } catch { fail('FILTER', 'Invalid regular expression.'); }
  return o;
}
export const fingerprint = options => JSON.stringify(options);
export function makeMatcher(o) {
  const regex = o.regex ? new RegExp(o.regex, 'iu') : null;
  return item => (o.type === 'all' || o.type === item.type)
    && (!o.include.length || o.include.includes(item.subreddit.toLowerCase()))
    && !o.exclude.includes(item.subreddit.toLowerCase())
    && (o.after === null || item.created >= o.after) && (o.before === null || item.created <= o.before)
    && item.text.toLowerCase().includes(o.contains.toLowerCase()) && (!regex || regex.test(item.text))
    && (o.minScore === null || (Number.isFinite(item.score) && item.score >= o.minScore))
    && (o.maxScore === null || (Number.isFinite(item.score) && item.score <= o.maxScore))
    && (o.edited === 'all' || (typeof item.edited === 'boolean' && item.edited === (o.edited === 'yes')));
}
export function eligibility(item, account, mode) {
  if (!account?.id || typeof account?.name !== 'string' || typeof item?.author !== 'string' || item.authorId !== account.id || item.author.toLowerCase() !== account.name.toLowerCase()) return 'Ownership could not be verified';
  if (!/^t[13]_[a-z0-9]+$/.test(item.id)) return 'Invalid content ID';
  if (item.deleted) return 'Already deleted';
  if (mode !== 'delete' && !item.editable) return 'Content cannot be edited; no deletion fallback';
  return '';
}
