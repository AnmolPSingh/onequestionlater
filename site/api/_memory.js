// What Anmol AI remembers between questions, in the same Upstash Redis as the rate limits. Each conversation is
// one record for 90 days: where the visitor came from, what they asked, and the model's notes on who they are and
// what they need. Leads (a real need, or an email they chose to give) and questions it couldn't answer are kept in
// their own lists, read by api/insights.js. As the visitor talks, the model fills in a brief (their problem, goal,
// how it works today, constraints, and a first read). Once the brief has a problem, the conversation waits in
// "pending" until the visitor goes quiet; then finalize() sends Anmol the brief by email (Resend), once, or again
// as an update if they came back and said more. IP addresses are never stored, only a short hash. Nothing here
// ever stops an answer: failures are logged and the chat carries on.
// Configuration: the Redis variables in _guard.js, RESEND_API_KEY, LEAD_EMAIL_TO and LEAD_EMAIL_FROM (optional).
import { redis, hash } from './_guard.js';
import { safeLinks } from './_knowledge.js';

// A visitor saying they're Anmol or his team: worth a flag in the brief, never worth believing.
const CLAIMS = /\b(i am|i'm|this is|it's)\s+(anmol|your (creator|developer|maker|owner|admin|builder)|the (developer|admin|owner))\b|\b(i|we) (made|built|created) you\b/i;

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
// A brief field may come back as a list; it's kept as one line of text either way.
const field = (value, max = 500) => text(Array.isArray(value) ? value.filter((v) => typeof v === 'string').join('; ') : value, max);

export const BRIEF_FIELDS = ['problem', 'context', 'current_process', 'cost_today', 'goal', 'success', 'budget', 'timeline', 'tools', 'decider', 'related_project', 'first_steps', 'open_questions'];

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
    detail: text(notes.detail, 160),
    asked_detail: notes.asked_detail === true,
    offered_handoff: notes.offered_handoff === true,
    brief: Object.fromEntries(BRIEF_FIELDS.map((k) => [k, field(notes.brief?.[k])])),
  };
}

// Earlier notes stay unless this turn has something new, field by field inside the brief too; "answered" is
// about this turn only.
export const merge = (before = {}, now = {}) => Object.fromEntries(
  Object.keys({ ...before, ...now }).map((k) => {
    if (k === 'answered') return [k, now[k]];
    if (k === 'brief') return [k, merge(before.brief, now.brief)];
    return [k, now[k] || before[k] || ''];
  }),
);

// A brief is worth sending once the visitor has described a problem.
export const hasBrief = (conv) => Boolean(conv?.notes?.brief?.problem || conv?.notes?.problem);

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
    conv.last = now;
    const lead = conv.notes.intent === 'high' || Boolean(conv.notes.email);

    const old = now - TTL * 1000;
    const commands = [
      ['SET', `conv:${id}`, JSON.stringify(conv), 'EX', TTL],
      ['ZADD', 'convs', now, id], ['ZREMRANGEBYSCORE', 'convs', 0, old],
    ];
    if (lead) commands.push(['ZADD', 'leads', now, id], ['ZREMRANGEBYSCORE', 'leads', 0, old]);
    if (hasBrief(conv)) commands.push(['ZADD', 'pending', now, id]);
    if (notes.answered === false) commands.push(['ZINCRBY', 'gaps', 1, question.toLowerCase().trim().slice(0, 200)], ['ZREMRANGEBYRANK', 'gaps', 0, -(MAX_GAPS + 1)]);
    await redis(commands);
  } catch (err) {
    console.error('ask: could not remember the conversation', err.message);
  }
}

const LABELS = {
  problem: 'The problem', context: 'Context', current_process: 'How it works today', cost_today: 'What it costs them now',
  goal: 'Goal', success: 'How they would know it worked', budget: 'Budget', timeline: 'Timeline', tools: 'Tools they use',
  decider: 'Who decides', related_project: 'Closest project of mine', first_steps: 'First steps I suggested', open_questions: 'Ask on the call',
};
const SECTIONS = [
  ['THE PROBLEM', ['problem', 'context']],
  ['TODAY', ['current_process', 'cost_today']],
  ['GOAL', ['goal', 'success']],
  ['CONSTRAINTS', ['budget', 'timeline', 'tools', 'decider']],
  ['FIRST READ', ['related_project', 'first_steps']],
  ['OPEN QUESTIONS', ['open_questions']],
];

// The brief as Anmol reads it: who, then each section that has something in it, then the whole conversation.
export function briefEmail(conv, update = false) {
  const n = conv.notes || {};
  const b = { ...(n.brief || {}) };
  if (!b.problem && n.problem) b.problem = n.problem;
  const who = [
    n.name && `Name: ${n.name}`,
    n.email && `Email: ${n.email} (reply to this email to reach them)`,
    n.detail && `They said: ${n.detail}`,
    n.visitor_type && `Who: ${n.visitor_type}${n.org_type ? `, ${n.org_type}` : ''}`,
    (conv.turns || []).some((t) => CLAIMS.test(t.q || '')) && 'Says they\'re Anmol or built this: unverified',
  ].filter(Boolean);
  const sections = SECTIONS.flatMap(([title, keys]) => {
    const rows = keys.filter((k) => b[k]).map((k) => `${LABELS[k]}: ${b[k]}`);
    if (title === 'FIRST READ' && n.vision) rows.unshift(`Reframe: ${n.vision}`);
    return rows.length ? ['', title, ...rows] : [];
  });
  const lines = [
    'WHO',
    ...(who.length ? who : ['They didn\'t say.']),
    ...sections,
    '',
    `Came from: ${conv.page || '/'}${conv.referrer ? ` via ${conv.referrer}` : ''}${conv.country ? `, ${conv.country}` : ''}, ${conv.device}, ${conv.channel}`,
    '',
    'THE CONVERSATION',
    ...(conv.turns || []).flatMap((t) => [`> ${t.q}`, t.a, '']),
  ];
  // Visitors can put anything in what they type, so only allow-listed links reach Anmol's inbox.
  return {
    subject: safeLinks(`${update ? 'Updated brief' : 'Brief'}: ${(b.problem || n.visitor_type || 'a new conversation').slice(0, 70)}`, '[link removed]'),
    text: safeLinks(lines.join('\n'), '[link removed]'),
  };
}

async function send(conv, update) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error('brief: RESEND_API_KEY is not set'); return false; }
  const { subject, text: body } = briefEmail(conv, update);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: LEAD_FROM, to: [LEAD_TO], subject, text: body, ...(conv.notes?.email && { reply_to: conv.notes.email }) }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) console.error('brief: email failed', res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

// Sends the brief for one conversation if it has one, the visitor has been quiet for at least minIdle ms, and
// it hasn't already gone out since their last message. Returns what happened, for the caller's log.
export async function finalize(id, { minIdle = 0, now = Date.now(), deliver = send } = {}) {
  if (!validId(id)) return 'bad id';
  const conv = await recall(id);
  if (!conv) return 'gone';
  if (!hasBrief(conv)) return 'no brief';
  const last = conv.last || Date.parse(conv.updated) || 0;
  // When it was last sent lives in its own key, so sending never overwrites a turn the visitor adds meanwhile.
  const [sentAt] = (await redis([['GET', `sent:${id}`]])) || [];
  if (Number(sentAt) >= last) { await redis([['ZREM', 'pending', id]]); return 'already sent'; }
  if (now - last < minIdle) return 'still talking';
  if (!(await deliver(conv, Boolean(sentAt)))) return 'failed';
  await redis([['SET', `sent:${id}`, now, 'EX', TTL], ['ZREM', 'pending', id]]);
  return 'sent';
}

// Every conversation that has been quiet for at least minIdle ms and still owes Anmol a brief.
export async function finalizeQuiet({ minIdle, limit = 100, now = Date.now(), deliver = send } = {}) {
  const [ids = []] = (await redis([['ZRANGEBYSCORE', 'pending', 0, now - minIdle, 'LIMIT', 0, limit]])) || [];
  const results = [];
  for (const id of ids) results.push([id, await finalize(id, { minIdle, now, deliver })]);
  return results;
}
