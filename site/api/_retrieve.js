// Finds what Anmol AI needs for one question, instead of sending everything it knows every time. The first two
// sections of the KNOWLEDGE (who Anmol is, what he helps with, how to reach him) always go; the rest comes from
// Upstash Vector, filled by scripts/index-knowledge.mjs. When a visitor is describing a problem, it also brings
// the closest learnings from his projects and the closest parts of his method. If the search isn't set up or fails, the whole KNOWLEDGE goes, as before.
// Configuration: UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN. The underscore keeps Vercel from serving it.
import { KNOWLEDGE } from './_knowledge.js';

const TOP = 5; // passages per question
const LEARNINGS = 3; // extra learnings when the visitor describes a problem
const METHOD = 2; // and how Anmol works through one (knowledge/method.md)
export const CORE = KNOWLEDGE.split(/\n(?=## )/).slice(0, 2).join('\n\n');

async function search(data, topK, filter) {
  const res = await fetch(`${process.env.UPSTASH_VECTOR_REST_URL}/query-data`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.UPSTASH_VECTOR_REST_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ data, topK, includeData: true, ...(filter && { filter }) }),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Upstash Vector returned ${res.status}`);
  return (await res.json()).result || [];
}

export async function retrieve(question, problem = false) {
  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) return KNOWLEDGE;
  try {
    const [facts, learnings, method] = await Promise.all([
      search(question, TOP),
      problem ? search(question, LEARNINGS, "kind = 'learning'") : [],
      problem ? search(question, METHOD, "kind = 'method'") : [],
    ]);
    const seen = new Set();
    const found = [...facts, ...learnings, ...method].filter((m) => m.data && !seen.has(m.id) && seen.add(m.id)).map((m) => m.data);
    if (!found.length) return KNOWLEDGE;
    return `${CORE}\n\n## Most relevant to this question\n\n${found.join('\n\n---\n\n')}`;
  } catch (err) {
    console.error('ask: search unavailable, sending the full knowledge', err.message);
    return KNOWLEDGE;
  }
}
