// Anmol AI's server pieces that don't need a network: cleaning answers, reading the model's JSON, the notes it
// may keep, the passages it searches, and the insights key. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tidy, parseAnswer } from '../api/chat.js';
import { cleanNotes, validEmail, leadEmail } from '../api/_memory.js';
import { chunks, pieces } from '../scripts/index-knowledge.mjs';
import { authorised, GET } from '../api/insights.js';

test('tidy keeps allowed links and drops others, em dashes and model names', () => {
  assert.equal(tidy('See https://onequestionlater.com/work/penname and https://evil.example.com'), 'See https://onequestionlater.com/work/penname and');
  assert.equal(tidy('Quick — and clear'), 'Quick, and clear');
  assert.match(tidy('I run on Llama'), /under the hood/);
});

test('parseAnswer reads JSON, JSON inside text, and falls back to plain text', () => {
  assert.deepEqual(parseAnswer('{"reply":"Hi","notes":{"intent":"high"}}'), { reply: 'Hi', notes: { intent: 'high' } });
  assert.deepEqual(parseAnswer('Sure: {"reply":"Hi"}'), { reply: 'Hi', notes: null });
  assert.deepEqual(parseAnswer('Just words'), { reply: 'Just words', notes: null });
  assert.equal(parseAnswer('{"reply": "cut off').reply, ''); // broken JSON never reaches the visitor
});

test('cleanNotes keeps only known shapes, and contact details the visitor typed', () => {
  const notes = cleanNotes({ visitor_type: 'hacker', intent: 'urgent', email: 'sam@charity.org', name: 'Sam', problem: 'x'.repeat(900) }, 'I am Sam');
  assert.equal(notes.visitor_type, '');
  assert.equal(notes.intent, '');
  assert.equal(notes.email, ''); // the model made it up: the visitor never typed it
  assert.equal(notes.name, 'Sam');
  assert.equal(notes.problem.length, 300);
  assert.equal(cleanNotes({ email: 'Sam@Charity.org' }, 'reach me at sam@charity.org').email, 'sam@charity.org');
  assert.deepEqual(cleanNotes('nope'), {});
});

test('validEmail', () => {
  assert.ok(validEmail('a.b+c@example.co.uk'));
  for (const bad of ['', 'nope', 'a@b', 'a b@c.com', '<a@b.com>', `${'a'.repeat(250)}@b.com`]) assert.ok(!validEmail(bad), bad);
});

test('leadEmail carries the problem, the first read and the conversation', () => {
  const { subject, text } = leadEmail({ page: '/', device: 'mobile', channel: 'voice', turns: [{ q: 'Reports take a week', a: 'Who reads them?' }], notes: { problem: 'Reports take a week', vision: 'Fewer, earlier reports', email: 'a@b.org' } });
  assert.match(subject, /Reports take a week/);
  assert.match(text, /First read: Fewer, earlier reports/);
  assert.match(text, /> Reports take a week\nWho reads them\?/);
});

test('chunks tag project learnings and keep the core out of the index', () => {
  const all = chunks({
    knowledge: '# Anmol\nwho\n\n## What Anmol can help with\nlots\n\n## His story\nradio',
    work: [['demo', '## The question\nWhy?\n\n## What I found\nThe queue moves.\n\n## What it became\nFaster.']],
    notes: [['learnings', '## Take things out\nStart there.'], ['extra', '## Talks\nISDI']],
  });
  const byId = Object.fromEntries(all.map((c) => [c.id, c.metadata.kind]));
  assert.deepEqual(byId, { 'knowledge#his-story': 'fact', 'work:demo#the-question': 'work', 'work:demo#what-i-found': 'learning', 'work:demo#what-it-became': 'work', 'note:learnings#take-things-out': 'learning', 'note:extra#talks': 'fact' });
  assert.match(all.find((c) => c.id === 'work:demo#what-i-found').data, /onequestionlater\.com\/work\/demo/);
});

test('pieces split long text between paragraphs, under the word limit', () => {
  const para = Array(100).fill('word').join(' ');
  const out = pieces([para, para, para, para].join('\n\n'));
  assert.equal(out.length, 2);
  assert.ok(out.every((p) => p.split(/\s+/).length <= 250));
});

test('the real sources index cleanly with unique ids', () => {
  const all = chunks();
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  assert.ok(all.some((c) => c.metadata.kind === 'learning'));
});

test('insights needs the exact key', async () => {
  const key = 'k'.repeat(32);
  assert.ok(authorised(`Bearer ${key}`, key));
  assert.ok(!authorised(`Bearer ${key}x`, key));
  assert.ok(!authorised(null, key));
  assert.ok(!authorised('Bearer short', 'short')); // a short key is never accepted
  process.env.INSIGHTS_TOKEN = key;
  const res = await GET(new Request('http://localhost/api/insights', { headers: { authorization: 'Bearer wrong' } }));
  assert.equal(res.status, 403);
});
