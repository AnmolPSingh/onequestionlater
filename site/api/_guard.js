// What every Anmol AI route checks before spending anything: the request comes from the site itself, and the
// visitor is inside their limits (kept in Upstash Redis, so they hold across every server). Shared by chat,
// transcribe and speak. The underscore keeps Vercel from serving this file as a route.
const PER_MINUTE = 6; // per visitor, per kind
const PER_DAY = 40; // per visitor, per kind
const SITE_PER_DAY = 900; // for everyone together, per kind: the free quota can never be spent in one day
const SITES = ['https://onequestionlater.com', 'https://www.onequestionlater.com'];

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function allowedOrigin(origin) {
  if (!origin) return false;
  if (SITES.includes(origin)) return true;
  const own = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map((host) => `https://${host}`);
  if (own.includes(origin)) return true; // this deployment's own preview address
  return process.env.VERCEL_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin);
}

export const visitor = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';

export async function hash(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Runs Redis commands in one round trip and returns their results, or null when Redis isn't configured.
export async function redis(commands) {
  // Vercel's Upstash integration may name these either way.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Redis returned ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

// Counts this visitor's requests of one kind this minute and today, and the whole site's today, in one round trip.
export async function withinLimits(ip, kind = 'ask') {
  const who = await hash(ip); // the address itself is never stored
  const minute = Math.floor(Date.now() / 60000);
  const day = new Date().toISOString().slice(0, 10);
  const keys = [`${kind}:m:${who}:${minute}`, `${kind}:d:${who}:${day}`, `${kind}:site:${day}`];
  const results = await redis([['INCR', keys[0]], ['EXPIRE', keys[0], 70], ['INCR', keys[1]], ['EXPIRE', keys[1], 90000], ['INCR', keys[2]], ['EXPIRE', keys[2], 90000]]);
  if (!results) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('Rate limiting is not configured');
    return true; // local development only
  }
  const [minuteCount, , dayCount, , siteCount] = results;
  return minuteCount <= PER_MINUTE && dayCount <= PER_DAY && siteCount <= SITE_PER_DAY;
}

// Speech is only ever made from answers the chat itself wrote, so no one can put words in Anmol's cloned voice.
// The chat signs each answer; speak checks the signature. Keyed by the ElevenLabs key, which only the server holds.
export async function sign(text) {
  const secret = process.env.ELEVENLABS_API_KEY;
  if (!secret) return null; // no voice configured: answers go out unsigned and the page stays text-only
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
