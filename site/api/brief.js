// Sends Anmol the brief from a conversation once the visitor has gone quiet. Two ways in:
// POST, from the chat in the browser (navigator.sendBeacon) when the visitor closes the chat or leaves the page.
//   Leaving counts as quiet at once; a tab that's only hidden waits until the last message is a few minutes old.
// GET, from the daily Vercel cron (vercel.json), which sends every conversation quiet for half an hour or more.
//   Only with CRON_SECRET, which Vercel sends as a bearer token.
// The chat itself also clears a few quiet conversations after each answer (chat.js), so briefs don't wait a day.
// Configuration: CRON_SECRET, plus the Redis and Resend variables in _guard.js and _memory.js.
import { timingSafeEqual } from 'node:crypto';
import { json, allowedOrigin, visitor, withinLimits } from './_guard.js';
import { finalize, finalizeQuiet, validId } from './_memory.js';

export const HIDDEN_WAIT = 3 * 60 * 1000; // a hidden tab may come back
export const QUIET = 30 * 60 * 1000; // what the cron counts as gone quiet

export function cronAllowed(header, secret = process.env.CRON_SECRET) {
  if (!secret || typeof header !== 'string') return false;
  const given = Buffer.from(header);
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function POST(request) {
  if (!allowedOrigin(request.headers.get('origin'))) return json({ error: 'forbidden' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 500) return json({ error: 'too long' }, 413);
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'bad request' }, 400); } // beacons arrive as text
  if (!validId(body?.conversation)) return json({ error: 'bad request' }, 400);
  try {
    if (!(await withinLimits(visitor(request), 'brief'))) return json({ error: 'limited' }, 429);
    const result = await finalize(body.conversation, { minIdle: body.leaving === true ? 0 : HIDDEN_WAIT });
    console.log('brief:', result);
    return json({ ok: true });
  } catch (err) {
    console.error('brief: could not finalize', err.message);
    return json({ error: 'unavailable' }, 503);
  }
}

export async function GET(request) {
  if (!cronAllowed(request.headers.get('authorization'))) return json({ error: 'forbidden' }, 403);
  try {
    const results = await finalizeQuiet({ minIdle: QUIET });
    console.log('brief: cron', results.map(([, r]) => r).join(', ') || 'nothing waiting');
    return json({ ok: true, count: results.length });
  } catch (err) {
    console.error('brief: cron failed', err.message);
    return json({ error: 'unavailable' }, 502);
  }
}
