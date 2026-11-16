// Anmol AI's spoken answers, in Anmol's cloned voice through ElevenLabs. It only voices answers the chat itself
// wrote: each carries a signature from chat.js, checked here, so no one can make the voice say anything else.
// Links are left out of the speech (they stay in the written answer). Audio streams straight back, never stored.
// Configuration: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL (optional). Limits count under "say".
import { timingSafeEqual } from 'node:crypto';
import { json, allowedOrigin, visitor, withinLimits, sign } from './_guard.js';

const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5'; // the fastest to first sound, which matters in a conversation
const MAX_TEXT = 2000; // the chat's own longest answer

const spoken = (text) => text.replace(/(https?:\/\/|mailto:)[^\s<>"']+/g, '').replace(/\s+([.,;:!?])/g, '$1').replace(/[:,]\s*$/gm, '.').replace(/\s{2,}/g, ' ').trim();

const same = (a, b) => typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request) {
  if (!allowedOrigin(request.headers.get('origin'))) return json({ error: 'forbidden' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 8000) return json({ error: 'too long' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400); }
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text || text.length > MAX_TEXT) return json({ error: 'bad request' }, 400);

  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) {
    console.error('say: ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is not set');
    return json({ error: 'unavailable' }, 503);
  }
  if (!same(body?.voice, await sign(text))) return json({ error: 'forbidden' }, 403);

  const words = spoken(text);
  if (!words) return new Response(null, { status: 204 }); // nothing but a link: nothing to say

  try {
    if (!(await withinLimits(visitor(request), 'say'))) return json({ error: 'busy' }, 429);
  } catch (err) {
    console.error('say: rate limiter unavailable', err.message);
    return json({ error: 'unavailable' }, 503);
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: words, model_id: MODEL }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok || !res.body) {
      console.error('say: voice returned', res.status, (await res.text()).slice(0, 300));
      return json({ error: res.status === 429 ? 'busy' : 'unavailable' }, res.status === 429 ? 429 : 502);
    }
    return new Response(res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('say: voice request failed', err.message);
    return json({ error: 'unavailable' }, 502);
  }
}
