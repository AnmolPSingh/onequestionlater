// Anmol's private view of what Anmol AI has heard: the briefs (sent, or waiting for the visitor to go quiet), leads, recent conversations, who's visiting and from where,
// and the questions it couldn't answer. Read by /insights. Only with the INSIGHTS_TOKEN (a long random string set
// in Vercel); without it, nothing. Configuration: INSIGHTS_TOKEN and the Redis variables in _guard.js.
import { timingSafeEqual } from 'node:crypto';
import { json, redis } from './_guard.js';
import { hasBrief } from './_memory.js';

const RECENT = 100;
const MIN_TOKEN = 24;

export function authorised(header, token = process.env.INSIGHTS_TOKEN) {
  if (!token || token.length < MIN_TOKEN || typeof header !== 'string') return false;
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ''));
  const wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

const tally = (items) => Object.entries(items.reduce((acc, v) => (v ? { ...acc, [v]: (acc[v] || 0) + 1 } : acc), {})).sort((a, b) => b[1] - a[1]);

export async function GET(request) {
  if (!authorised(request.headers.get('authorization'))) return json({ error: 'forbidden' }, 403);
  try {
    const lists = await redis([
      ['ZREVRANGE', 'convs', 0, RECENT - 1],
      ['ZREVRANGE', 'leads', 0, RECENT - 1],
      ['ZREVRANGE', 'gaps', 0, 49, 'WITHSCORES'],
      ['ZRANGE', 'pending', 0, -1],
    ]);
    if (!lists) return json({ error: 'Redis is not configured' }, 503);
    const [recent, leadIds, gapFlat, pending] = lists;
    const ids = [...new Set([...leadIds, ...recent, ...pending])];
    const [records = [], sent = []] = ids.length
      ? await redis([['MGET', ...ids.map((id) => `conv:${id}`)], ['MGET', ...ids.map((id) => `sent:${id}`)]])
      : [[], []];
    const waiting = new Set(pending);
    const byId = Object.fromEntries(records.map((raw, i) => raw && { ...JSON.parse(raw), briefSent: Number(sent[i]) || null, briefWaiting: waiting.has(ids[i]) }).filter(Boolean).map((c) => [c.id, c]));
    const convs = recent.map((id) => byId[id]).filter(Boolean);
    return json({
      briefs: Object.values(byId).filter(hasBrief).sort((a, b) => (b.last || 0) - (a.last || 0)),
      leads: leadIds.map((id) => byId[id]).filter(Boolean),
      conversations: convs,
      counts: {
        visitors: tally(convs.map((c) => c.notes?.visitor_type || 'unknown')),
        countries: tally(convs.map((c) => c.country || 'unknown')),
        referrers: tally(convs.map((c) => c.referrer || 'direct')),
        pages: tally(convs.map((c) => c.page || '/')),
        channels: tally(convs.map((c) => c.channel)),
      },
      gaps: Array.from({ length: gapFlat.length / 2 }, (_, i) => [gapFlat[i * 2], Number(gapFlat[i * 2 + 1])]),
    });
  } catch (err) {
    console.error('insights: could not read', err.message);
    return json({ error: 'unavailable' }, 502);
  }
}
