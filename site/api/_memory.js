// What Anmol AI remembers between questions, in the same Upstash Redis as the rate limits. Each conversation is
// one record for 90 days: where the visitor came from, what they asked, and the model's notes on who they are and
// what they need. Leads (a real need, or an email they chose to give) and questions it couldn't answer are kept in
// their own lists, read by api/insights.js. A new lead sends Anmol one email (Resend). IP addresses are never
// stored, only a short hash. Nothing here ever stops an answer: failures are logged and the chat carries on.
// Configuration: the Redis variables in _guard.js, RESEND_API_KEY, LEAD_EMAIL_TO and LEAD_EMAIL_FROM (optional).
import { redis, hash } from './_guard.js';

const DAYS = 90;
const TTL = DAYS * 86400;
const MAX_TURNS = 40;
const MAX_GAPS = 500;
const TYPES = ['client', 'peer', 'recruiter', 'student', 'press', 'curious'];
const INTENTS = ['low', 'medium', 'high'];
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@<>"',;]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const LEAD_TO = process.env.LEAD_EMAIL_TO || 'anmol@philanthropel.com';
const LEAD_FROM = process.env.LEAD_EMAIL_FROM || 'Anmol AI <onboarding@resend.dev>'; // works until a domain is verified in Resend

export const validId = (id) => typeof id === 'string' && ID.test(id);
export const validEmail = (email) => typeof email === 'string' && email.length <= 254 && EMAIL.test(email);

const text = (value, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// The model's notes are untrusted (a visitor can steer them), so only known fields in known shapes are kept,
// and an email or name only when the visitor actually typed it.
export function cleanNotes(notes, said = '') {
  if (!notes || typeof notes !== 'object') return {};
  const typed = said.toLowerCase();
  const email = text(notes.email, 254).toLowerCase();
  const name = text(notes.name, 80);
  return {
    visitor_type: TYPES.includes(notes.visitor_type) ? notes.visitor_type : '',
    org_type: text(notes.org_type, 120),
    problem: text(notes.problem),
    vision: text(notes.vision, 500),
    intent: INTENTS.includes(notes.intent) ? notes.intent : '',
    answered: notes.answered !== false,
    email: validEmail(email) && typed.includes(email) ? email : '',
    name: name && typed.includes(name.toLowerCase()) ? name : '',
  };
}

// Earlier notes stay unless this turn has something new; "answered" is about this turn only.
const merge = (before = {}, now = {}) => Object.fromEntries(
  Object.keys({ ...before, ...now }).map((k) => [k, k === 'answered' ? now[k] : (now[k] || before[k] || '')]),
);

export async function recall(id) {
  if (!validId(id)) return null;
  try {
    const [raw] = (await redis([['GET', `conv:${id}`]])) || [];
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('ask: could not recall the conversation', err.message);
    return null;
  }
}

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 100); } catch { return ''; } };

export async function remember({ id, before, request, meta, question, answer, notes }) {
  if (!validId(id)) return;
  try {
    const now = Date.now();
    const conv = before || {
      id,
      started: new Date(now).toISOString(),
      visitor: await hash(request.headers.get('x-forwarded-for') || 'unknown'),
      country: text(request.headers.get('x-vercel-ip-country'), 4),
      device: /mobi|android|iphone/i.test(request.headers.get('user-agent') || '') ? 'mobile' : 'desktop',
      page: typeof meta?.page === 'string' && meta.page.startsWith('/') ? meta.page.slice(0, 200) : '',
      referrer: host(meta?.referrer),
      turns: [],
      notes: {},
    };
    conv.updated = new Date(now).toISOString();
    conv.channel = meta?.channel === 'voice' ? 'voice' : 'text';
    conv.turns = [...conv.turns, { q: question.slice(0, 500), a: answer.slice(0, 2000), channel: conv.channel }].slice(-MAX_TURNS);
    conv.notes = merge(conv.notes, notes);
    const lead = conv.notes.intent === 'high' || Boolean(conv.notes.email);
    const tell = lead && (!conv.alerted || (conv.notes.email && !conv.alertedEmail));
    if (tell && (await alert(conv))) { conv.alerted = true; conv.alertedEmail ||= Boolean(conv.notes.email); }

    const old = now - TTL * 1000;
    const commands = [
      ['SET', `conv:${id}`, JSON.stringify(conv), 'EX', TTL],
      ['ZADD', 'convs', now, id], ['ZREMRANGEBYSCORE', 'convs', 0, old],
    ];
    if (lead) commands.push(['ZADD', 'leads', now, id], ['ZREMRANGEBYSCORE', 'leads', 0, old]);
    if (notes.answered === false) commands.push(['ZINCRBY', 'gaps', 1, question.toLowerCase().trim().slice(0, 200)], ['ZREMRANGEBYRANK', 'gaps', 0, -(MAX_GAPS + 1)]);
    await redis(commands);
  } catch (err) {
    console.error('ask: could not remember the conversation', err.message);
  }
}

export function leadEmail(conv) {
  const n = conv.notes;
  const lines = [
    ...[
      n.name && `Name: ${n.name}`,
      n.email && `Email: ${n.email}`,
      n.visitor_type && `Who: ${n.visitor_type}${n.org_type ? `, ${n.org_type}` : ''}`,
      n.problem && `Problem: ${n.problem}`,
      n.vision && `First read: ${n.vision}`,
      `Came from: ${conv.page || '/'}${conv.referrer ? ` via ${conv.referrer}` : ''}${conv.country ? `, ${conv.country}` : ''}, ${conv.device}, ${conv.channel}`,
    ].filter(Boolean),
    '',
    'The conversation:',
    ...conv.turns.flatMap((t) => [`> ${t.q}`, t.a, '']),
  ];
  return {
    subject: `Anmol AI lead: ${n.problem ? n.problem.slice(0, 70) : n.visitor_type || 'a new conversation'}`,
    text: lines.join('\n'),
  };
}

async function alert(conv) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const { subject, text: body } = leadEmail(conv);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: LEAD_FROM, to: [LEAD_TO], subject, text: body, ...(conv.notes.email && { reply_to: conv.notes.email }) }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) console.error('ask: lead email failed', res.status, (await res.text()).slice(0, 200));
  return res.ok;
}
