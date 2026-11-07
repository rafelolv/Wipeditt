import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, parseCommentsCSV } from '../src/desktop/import.js';

test('CSV parsing preserves quoted commas, line breaks, quotes and the BOM', () => {
  const rows = parseCSV('\uFEFFid,body\r\n1,"hello, world"\r\n2,"line\nbreak ""quoted"""');
  assert.deepEqual(rows, [['id', 'body'], ['1', 'hello, world'], ['2', 'line\nbreak "quoted"']]);
});

test('comments export imports own live comments and skips unusable rows', () => {
  const csv = [
    'id,permalink,date,subreddit,body,author,score,edited',
    'abc,https://www.reddit.com/r/privacy/comments/p/title/abc/,2024-01-02T03:04:05Z,privacy,"hello, world",demo_user,4,false',
    'def,https://www.reddit.com/r/privacy/comments/p/title/def/,2024-02-02T03:04:05Z,privacy,"line one\nline two",DEMO_USER,7,true',
    'other,https://www.reddit.com/r/privacy/comments/p/title/other/,2024-03-02T03:04:05Z,privacy,"not mine",someone_else,1,false',
    'gone,https://www.reddit.com/r/privacy/comments/p/title/gone/,2024-04-02T03:04:05Z,privacy,"[deleted]",demo_user,1,false',
    'bad-date,https://www.reddit.com/r/privacy/comments/p/title/bad/,nonsense,privacy,"body",demo_user,1,false',
    'no-author,https://www.reddit.com/r/privacy/comments/p/title/no-author/,2024-05-02T03:04:05Z,privacy,"body",,1,false'
  ].join('\r\n');
  const result = parseCommentsCSV(csv, 'demo_user');
  assert.equal(result.items.length, 2);
  assert.equal(result.skipped, 4);
  assert.deepEqual(result.items.map(item => item.id), ['t1_abc', 't1_def']);
  assert.equal(result.items[0].text, 'hello, world');
  assert.equal(result.items[1].authorId, 'reddit:demo_user');
  assert.equal(result.items[1].score, 7);
  assert.equal(result.items[1].edited, true);
  assert.equal(result.items[0].type, 'comment');
});

test('comments export requires the columns from Reddit comments.csv', () => {
  assert.throws(() => parseCommentsCSV('id,body\nabc,text', 'demo_user'), { code: 'IMPORT' });
  assert.throws(() => parseCommentsCSV('id,permalink,date,subreddit,body,score\nabc,https://www.reddit.com/r/privacy/comments/p/title/abc/,2024-01-02T03:04:05Z,privacy,text,1', 'demo_user'), { code: 'IMPORT' });
  assert.throws(() => parseCommentsCSV('', 'demo_user'), { code: 'IMPORT' });
});
