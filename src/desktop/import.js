import { fail } from '../errors.js';
import { contentURL, REDDIT_CLASSIC } from './policy.js';

const MAX_ROWS = 100000;
const MAX_ITEMS = 100000;

// RFC 4180-style parsing without a third-party parser. Reddit exports quote
// commas, quotes and line breaks inside comment bodies.
export function parseCSV(source) {
  if (typeof source !== 'string') fail('IMPORT', 'The selected file is not readable text.');
  const text = source.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === '') { quoted = true; continue; }
    if (char === ',') { row.push(field); field = ''; continue; }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field); rows.push(row);
      row = []; field = '';
      if (rows.length > MAX_ROWS + 1) fail('IMPORT', 'This export is too large to review safely.');
      continue;
    }
    field += char;
  }
  if (quoted) fail('IMPORT', 'The CSV file ends inside a quoted comment.');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function column(header, ...names) {
  for (const name of names) {
    const index = header.indexOf(name);
    if (index !== -1) return index;
  }
  return -1;
}
function timestamp(value) {
  const text = String(value ?? '').trim();
  if (!text) return NaN;
  if (/^\d{9,13}$/.test(text)) {
    const number = Number(text);
    return text.length <= 10 ? number * 1000 : number;
  }
  return Date.parse(text);
}
function boolean(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', 'yes', '1'].includes(text)) return true;
  if (['false', 'no', '0'].includes(text)) return false;
  return null;
}

export function parseCommentsCSV(source, accountName) {
  const rows = parseCSV(source);
  if (rows.length < 2) fail('IMPORT', 'This CSV does not contain any comments.');
  const header = rows.shift().map(value => value.trim().toLowerCase());
  const idIndex = column(header, 'id');
  const permalinkIndex = column(header, 'permalink', 'link');
  const bodyIndex = column(header, 'body', 'text');
  const subredditIndex = column(header, 'subreddit');
  const dateIndex = column(header, 'date', 'created_utc', 'created');
  const authorIndex = column(header, 'author');
  const scoreIndex = column(header, 'score');
  const editedIndex = column(header, 'edited');
  if (idIndex === -1 || permalinkIndex === -1 || bodyIndex === -1 || subredditIndex === -1 || dateIndex === -1) {
    fail('IMPORT', 'Choose comments.csv from your Reddit data export. Required columns are missing.');
  }
  if (typeof accountName !== 'string' || !/^[A-Za-z0-9_-]+$/.test(accountName)) fail('IMPORT', 'Verify your Reddit account before importing comments.');
  const expected = accountName.toLowerCase();
  const items = [];
  let skipped = 0;
  for (const row of rows) {
    if (!row.length || (row.length === 1 && !row[0].trim())) continue;
    const rawId = String(row[idIndex] ?? '').trim().replace(/^t1_/i, '');
    let permalink = String(row[permalinkIndex] ?? '').trim();
    const body = String(row[bodyIndex] ?? '');
    const subreddit = String(row[subredditIndex] ?? '').trim();
    // An export without an author column belongs to the selected account only
    // as a preview claim. Native preflight independently checks actual ownership.
    const author = authorIndex === -1 ? accountName : String(row[authorIndex] ?? '').trim();
    const created = timestamp(row[dateIndex]);
    if (!/^[a-z0-9]+$/i.test(rawId) || !permalink || !body.trim() || !subreddit || !Number.isFinite(created) || !author || author === '[deleted]') { skipped++; continue; }
    try { permalink = contentURL(new URL(permalink, REDDIT_CLASSIC).href, `t1_${rawId.toLowerCase()}`); }
    catch { skipped++; continue; }
    if (expected && author.toLowerCase() !== expected) { skipped++; continue; }
    if (['[deleted]', '[removed]'].includes(body.trim().toLowerCase())) { skipped++; continue; }
    const score = scoreIndex === -1 ? null : Number(row[scoreIndex]);
    items.push({
      id: `t1_${rawId.toLowerCase()}`,
      author,
      authorId: `reddit:${author.toLowerCase()}`,
      subreddit,
      type: 'comment',
      created,
      score: Number.isFinite(score) ? score : null,
      edited: editedIndex === -1 ? null : boolean(row[editedIndex]),
      text: body,
      permalink,
      editable: true,
      deleted: false,
      imported: true
    });
    if (items.length > MAX_ITEMS) fail('IMPORT', 'This export has too many comments to review at once.');
  }
  return { items, skipped };
}
