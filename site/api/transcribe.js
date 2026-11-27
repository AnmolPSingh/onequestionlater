// Voice to text for Anmol AI: the page records a short clip and posts it here raw; Groq's Whisper turns it into
// the question, which the page then sends to the chat like any typed one. The audio is never stored or logged.
// Uses the chat's GROQ_API_KEY and the same origin check and limits (counted separately, under "hear").
import { json, allowedOrigin, visitor, withinLimits } from './_guard.js';
import { distance, words } from './_text.js';

const MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MAX_BYTES = 1_500_000; // about 45 seconds of the browser's compressed speech; the page stops at 30
const MAX_QUESTION = 500; // the chat's own limit
// Left to guess, Whisper heard Indian-accented English as Indonesian; the site is in English, so it listens for English,
// and the names it should expect help it spell them.
const LANGUAGE = 'en';
const NAMES = 'Anmol, Anmol AI, Philanthropel, One Question Later, Global Philanthropic.';
// Whisper invents words on near-silence: it reads the names above back, or fills in "Okay." or "Thank you."
// A stretch it rates as probably silent, or barely guessed, is dropped (both scores come with each segment).
const NO_SPEECH = 0.5; // chance the stretch is silence, above which it's dropped
const UNSURE = -1; // average log-probability of its words, below which it's dropped
const ECHO = 0.8; // share of the words that are the names above, at which a clip of three or more words is an echo; shorter ones must be all names
const NAME_WORDS = [...new Set(words(NAMES))];

const isName = (word) => NAME_WORDS.some((name) => distance(word, name) <= (name.length > 4 ? 2 : 0));

// The words someone actually said, from Whisper's detailed answer: unsure stretches out, and nothing if all
// that's left is the names it was told to expect.
export function spoken(data) {
  const segments = Array.isArray(data?.segments) ? data.segments : null;
  const text = segments
    ? segments.filter((s) => !(s.no_speech_prob > NO_SPEECH) && !(s.avg_logprob < UNSURE)).map((s) => String(s.text || '')).join(' ')
    : String(data?.text || '');
  const said = words(text);
  const names = said.filter(isName).length;
  if (!said.length || names === said.length || (said.length >= 3 && names / said.length >= ECHO)) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION);
}

const TYPES = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

export async function POST(request) {
  if (!allowedOrigin(request.headers.get('origin'))) return json({ error: 'forbidden' }, 403);
  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  const ext = TYPES[type];
  if (!ext) return json({ error: 'bad request' }, 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return json({ error: 'too long' }, 413);

  const audio = await request.arrayBuffer().catch(() => null);
  if (!audio?.byteLength) return json({ error: 'bad request' }, 400);
  if (audio.byteLength > MAX_BYTES) return json({ error: 'too long' }, 413); // content-length can be left out

  try {
    if (!(await withinLimits(visitor(request), 'hear'))) return json({ error: 'busy' }, 429);
  } catch (err) {
    console.error('hear: rate limiter unavailable', err.message);
    return json({ error: 'unavailable' }, 503);
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error('hear: GROQ_API_KEY is not set');
    return json({ error: 'unavailable' }, 503);
  }

  const form = new FormData();
  form.append('file', new Blob([audio], { type }), `question.${ext}`);
  form.append('model', MODEL);
  form.append('response_format', 'verbose_json'); // with each stretch's confidence, read by spoken()
  form.append('temperature', '0');
  form.append('language', LANGUAGE);
  form.append('prompt', NAMES);
  try {
    const res = await fetch(GROQ_URL, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error('hear: model returned', res.status, (await res.text()).slice(0, 300));
      return json({ error: res.status === 429 ? 'busy' : 'unavailable' }, res.status === 429 ? 429 : 502);
    }
    return json({ text: spoken(await res.json()) });
  } catch (err) {
    console.error('hear: model request failed', err.message);
    return json({ error: 'unavailable' }, 502);
  }
}
