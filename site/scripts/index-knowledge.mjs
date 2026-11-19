// Builds Anmol AI's searchable memory: everything it may draw on, cut into short passages and sent to Upstash
// Vector, which embeds the text itself (so no AI key is needed here). Runs before every build. Sources:
// the KNOWLEDGE in api/_knowledge.js (its first two sections are left out: chat.js sends them with every
// question anyway), every project page in src/content/work, and Anmol's own notes in site/knowledge.
// A project's "What I found", "What I tried" and "The next question", and all of knowledge/learnings.md, are
// tagged as learnings, which the chat pulls in when a visitor describes a problem.
// Configuration: UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN. Without them it skips, so local builds work.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { basename, join } from 'node:path';
import { KNOWLEDGE } from '../api/_knowledge.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://onequestionlater.com';
const MAX_WORDS = 250;
const LEARNING_HEADINGS = /^(what i found|what i tried|the next question)$/i;
const BATCH = 50;

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const words = (text) => text.split(/\s+/).filter(Boolean).length;

// Splits markdown into its "## " sections: [{ heading, body }]. Text before the first heading has no heading.
export function sections(markdown) {
  return markdown.split(/\n(?=## )/).map((part) => {
    const match = part.match(/^## (.+)\n?/);
    return { heading: match ? match[1].trim() : '', body: (match ? part.slice(match[0].length) : part).trim() };
  }).filter((s) => s.body);
}

// Keeps paragraphs together and cuts only between them, so no passage runs much past MAX_WORDS.
export function pieces(body) {
  const out = [];
  let current = '';
  const paras = body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').split(/\n{2,}/)
    .flatMap((p) => (words(p) > MAX_WORDS ? p.split('\n') : [p])) // a long list breaks at its lines
    .map((p) => p.trim()).filter(Boolean);
  for (const para of paras) {
    if (current && words(current) + words(para) > MAX_WORDS) { out.push(current); current = ''; }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current) out.push(current);
  return out;
}

// Every passage Anmol AI can find: { id, data, metadata: { source, kind } }.
export function chunks({ knowledge = KNOWLEDGE, work = readWork(), notes = readNotes() } = {}) {
  const out = [];
  const add = (source, heading, body, kind, title) => pieces(body).forEach((text, i) => out.push({
    id: `${source}#${slugify(heading) || 'intro'}${i ? `-${i}` : ''}`,
    data: `${title}${heading ? ` / ${heading}` : ''}\n${text}`,
    metadata: { source, kind },
  }));

  sections(knowledge).slice(2).forEach((s) => add('knowledge', s.heading, s.body, 'fact', 'About Anmol'));
  for (const [slug, markdown] of work) {
    for (const s of sections(markdown)) {
      add(`work:${slug}`, s.heading, s.body, LEARNING_HEADINGS.test(s.heading) ? 'learning' : 'work', `Project ${slug} (${SITE}/work/${slug})`);
    }
  }
  for (const [name, markdown] of notes) {
    const kind = name === 'learnings' ? 'learning' : 'fact';
    for (const s of sections(markdown)) add(`note:${name}`, s.heading, s.body, kind, kind === 'learning' ? 'What Anmol has learned' : 'About Anmol');
  }
  return out;
}

function readMarkdown(dir, skip = []) {
  return readdirSync(dir).filter((f) => f.endsWith('.md') && !skip.includes(f)).sort()
    .map((f) => [basename(f, '.md'), readFileSync(join(dir, f), 'utf8')]);
}
const readWork = () => readMarkdown(join(ROOT, 'src/content/work'));
const readNotes = () => readMarkdown(join(ROOT, 'knowledge'), ['README.md']);

async function vector(path, body) {
  const res = await fetch(`${process.env.UPSTASH_VECTOR_REST_URL}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.UPSTASH_VECTOR_REST_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Upstash Vector ${path} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).result;
}

async function existingIds() {
  const ids = [];
  let cursor = '0';
  do {
    const page = await vector('range', { cursor, limit: 1000 });
    ids.push(...page.vectors.map((v) => v.id));
    cursor = page.nextCursor;
  } while (cursor);
  return ids;
}

async function main() {
  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    console.warn('index-knowledge: Upstash Vector is not configured, skipping (the chat falls back to the full knowledge)');
    return;
  }
  const all = chunks();
  for (let i = 0; i < all.length; i += BATCH) await vector('upsert-data', all.slice(i, i + BATCH));
  const keep = new Set(all.map((c) => c.id));
  const stale = (await existingIds()).filter((id) => !keep.has(id));
  if (stale.length) await vector('delete', stale);
  console.log(`index-knowledge: ${all.length} passages indexed, ${stale.length} removed`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  // A failed index leaves the previous passages in place, which still work, so the deploy carries on; the log says why.
  main().catch((err) => console.error('index-knowledge: FAILED, the chat keeps the previous index.', err.message));
}
