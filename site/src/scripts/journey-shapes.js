// The philosophy page's formations, one per beat of the journey. Same encoding as shapes.js (x, y, z and
// w = behaviour code + alpha * 0.9). Every one uses the rotating code, so each formation turns slowly in depth
// on its own; HOT points carry the neon accent. `place` scales and lifts a formation: smaller and higher on a
// phone, where the words sit underneath it.
const GLOBE = 2;
const HOT = 5;
const TAU = Math.PI * 2;

const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
// A fixed scatter, so the clusters sit in the same places every visit.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writer(n, { scale, lift }) {
  const out = new Float32Array(n * 4);
  const put = (i, x, y, z, code, alpha) => {
    out[i * 4] = x * scale;
    out[i * 4 + 1] = y * scale + lift;
    out[i * 4 + 2] = z * scale;
    out[i * 4 + 3] = code + Math.min(1, alpha) * 0.9;
  };
  return { out, put };
}

// Tip a flat ring or disc up toward the viewer, so it reads as a circle that turns rather than a line.
const tipped = (x, y, z, by = 1.05) => [x, Math.cos(by) * y - Math.sin(by) * z, Math.sin(by) * y + Math.cos(by) * z];

// 01: a galaxy, two arms around a bright core. Where following questions starts.
export function galaxy(n, place) {
  const { out, put } = writer(n, place);
  const core = Math.floor(n * 0.07);
  for (let i = 0; i < n; i++) {
    if (i < core) {
      const r = Math.random() ** 2 * 0.12;
      const a = rand(TAU);
      put(i, ...tipped(Math.cos(a) * r, gauss() * 0.02, Math.sin(a) * r), HOT, rand(1, 0.6));
      continue;
    }
    const t = Math.random() ** 0.8;
    const a = (i % 2) * Math.PI + t * 3.4 * Math.PI;
    const r = 0.08 + t * 0.92;
    const spread = 0.04 + t * 0.09;
    put(i, ...tipped(Math.cos(a) * r + gauss() * spread, gauss() * 0.03 * (1 - t * 0.6), Math.sin(a) * r + gauss() * spread), GLOBE, rand(0.9, 0.15) * (1.1 - t * 0.6));
  }
  return out;
}

// The ten things found, as clusters scattered through space: where they are now, before the path joins them.
const FOUND = 10;
function foundCentres() {
  const r = seeded(7);
  return Array.from({ length: FOUND }, () => {
    const a = r() * TAU;
    const b = Math.acos(r() * 2 - 1);
    const d = 0.45 + r() * 0.4;
    return [Math.sin(b) * Math.cos(a) * d, Math.cos(b) * d * 0.8, Math.sin(b) * Math.sin(a) * d];
  });
}

export function found(n, place) {
  const { out, put } = writer(n, place);
  const centres = foundCentres();
  for (let i = 0; i < n; i++) {
    if (i % 5 < 2) { // faint dust between them
      put(i, rand(1, -1), rand(0.9, -0.9), rand(1, -1), GLOBE, rand(0.18, 0.04));
      continue;
    }
    const [x, y, z] = centres[i % FOUND];
    put(i, x + gauss() * 0.11, y + gauss() * 0.11, z + gauss() * 0.11, GLOBE, rand(0.55, 0.1));
  }
  return out;
}

// The same ten, now strung along one winding path, in the order they came; the last one, philanthropy, lit.
export function path(n, place) {
  const { out, put } = writer(n, place);
  const along = (t) => [-0.85 + t * 1.7, Math.sin(t * 5.6) * 0.32, Math.cos(t * 4.2) * 0.32];
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0) { // the thread between them
      const t = Math.random();
      const [x, y, z] = along(t);
      put(i, x + gauss() * 0.008, y + gauss() * 0.008, z + gauss() * 0.008, GLOBE, rand(0.7, 0.25));
      continue;
    }
    const k = i % FOUND;
    const [x, y, z] = along(k / (FOUND - 1));
    const last = k === FOUND - 1;
    put(i, x + gauss() * 0.075, y + gauss() * 0.075, z + gauss() * 0.075, last ? HOT : GLOBE, last ? rand(0.8, 0.25) : rand(0.55, 0.12));
  }
  return out;
}

// What each one left behind: seven clusters orbiting on one ring.
export function lessons(n, place) {
  const { out, put } = writer(n, place);
  for (let i = 0; i < n; i++) {
    if (i % 4 === 0) {
      const a = rand(TAU);
      put(i, ...tipped(Math.cos(a) * 0.72, gauss() * 0.01, Math.sin(a) * 0.72), GLOBE, rand(0.4, 0.1));
      continue;
    }
    const a = ((i % 7) / 7) * TAU;
    put(i, ...tipped(Math.cos(a) * 0.72 + gauss() * 0.085, gauss() * 0.085, Math.sin(a) * 0.72 + gauss() * 0.085), GLOBE, rand(0.6, 0.12));
  }
  return out;
}

// They accumulated: every cluster gathered into one body, layer on layer, brightest at the core.
export function accumulated(n, place) {
  const { out, put } = writer(n, place);
  for (let i = 0; i < n; i++) {
    const layer = i % 7;
    const r = 0.14 + layer * 0.085 + gauss() * 0.008;
    const a = rand(TAU);
    const b = Math.acos(rand(1, -1));
    put(i, Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r, layer < 2 ? HOT : GLOBE, rand(1, 0.25) * (1 - layer * 0.08));
  }
  return out;
}

// The behaviour that doesn't change: one steady ring.
export function constant(n, place) {
  const { out, put } = writer(n, place);
  for (let i = 0; i < n; i++) {
    const a = rand(TAU);
    const b = rand(TAU);
    const tube = 0.05 + Math.random() ** 3 * 0.12;
    const r = 0.68 + Math.cos(b) * tube;
    put(i, ...tipped(Math.cos(a) * r, Math.sin(b) * tube, Math.sin(a) * r, 1.15), i % 9 === 0 ? HOT : GLOBE, rand(1, 0.2));
  }
  return out;
}

// The loop: an orbit with six bright knots, one for each step, going round again.
export function loop(n, place) {
  const { out, put } = writer(n, place);
  for (let i = 0; i < n; i++) {
    const knot = i % 4 === 0;
    const a = knot ? ((i % 6) / 6) * TAU + gauss() * 0.06 : rand(TAU);
    const spread = knot ? 0.075 : 0.018;
    put(i, ...tipped(Math.cos(a) * 0.7 + gauss() * spread, gauss() * spread, Math.sin(a) * 0.7 + gauss() * spread, 0.9), knot ? HOT : GLOBE, knot ? rand(0.75, 0.2) : rand(0.6, 0.15));
  }
  return out;
}

// A quick self-check: every builder fills every particle, inside a sane box.
export function selfCheck() {
  const place = { scale: 0.6, lift: 0 };
  for (const build of [galaxy, found, path, lessons, accumulated, constant, loop]) {
    const s = build(1000, place);
    for (let i = 0; i < s.length; i++) if (!Number.isFinite(s[i]) || (i % 4 !== 3 && Math.abs(s[i]) > 2)) throw new Error(`${build.name} wrote ${s[i]} at ${i}`);
  }
  return true;
}
