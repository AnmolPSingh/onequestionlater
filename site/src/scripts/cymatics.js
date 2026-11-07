// Dust shaped by sound, in 3D. Every line of the philosophy sets a form: a ring, a wave reaching into the
// distance, a vibrating surface, a sphere, a loop. Each form is a set of points, and some of them move
// the way sound moves things: surfaces rise and fall as standing waves, ripples travel outward, a sphere
// breathes. Grains keep their positions and velocities between forms and travel through a slow swirl,
// so one form always flows into the next. No DOM in here, so selfCheck() runs in node.
const TAU = Math.PI * 2;
const POINTS = 6000;
const SPRING = 3.2; // how hard a grain is drawn to its point
const DAMP = 0.9; // velocity kept per 60th of a second
const MAX_SPEED = 2.8; // world units a second
const SWIRL = 0.35; // the slow current every grain drifts in, so travel is never a straight line

const gauss = (rand) => (rand() + rand() + rand() - 1.5) / 1.5;
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A Chladni plate's displacement for mode (n, m), with x and y in -1..1.
export function chladni(n, m, sign, x, y) {
  const u = (x + 1) / 2;
  const v = (y + 1) / 2;
  return Math.cos(Math.PI * n * u) * Math.cos(Math.PI * m * v) + sign * Math.cos(Math.PI * m * u) * Math.cos(Math.PI * n * v);
}

// Each point: x, y, z, lit, and how far it swings (d) and when (phase), for forms that vibrate.
function points(place) {
  const out = new Float32Array(POINTS * 6);
  for (let i = 0; i < POINTS; i++) {
    const [x, y, z, lit = 0, d = 0, phase = 0] = place(i);
    out.set([x, y, z, lit, d, phase], i * 6);
  }
  return out;
}

/* ---------- The forms ---------- */

// An opening: one ring of dust, wide enough that the words sit inside it.
const RING = 1.4;
const ring = (rand) => points((i) => {
  if (i % 12 === 0) return [gauss(rand) * 1.8, gauss(rand) * 1.2, gauss(rand) * 1.2]; // a little dust around it
  const a = rand() * TAU;
  const r = RING + gauss(rand) * 0.09;
  return [Math.cos(a) * r, Math.sin(a) * r, gauss(rand) * 0.08];
});

// Drifting: the ring let go, the dust wandering, with denser clumps where something caught my attention.
const clumps = (() => {
  const rand = seeded(7);
  return Array.from({ length: 12 }, () => [(rand() * 2 - 1) * 2.4, (rand() * 2 - 1) * 1.4, (rand() * 2 - 1) * 1.6]);
})();
const drift = (rand) => points((i) => {
  if (i % 5 < 3) return [(rand() * 2 - 1) * 3, (rand() * 2 - 1) * 1.8, (rand() * 2 - 1) * 2.2];
  const [x, y, z] = clumps[i % clumps.length];
  return [x + gauss(rand) * 0.16, y + gauss(rand) * 0.16, z + gauss(rand) * 0.16];
});

// A sound wave as a twisted ribbon reaching into the distance. It grows with each thing found; the far
// end, philanthropy, lights once it's reached.
const ribbon = (rand, found) => points(() => {
  const reach = 0.1 + 0.9 * (found / 10);
  const t = rand() * reach;
  const twist = t * 9;
  const across = (rand() - 0.5) * 0.5;
  return [-3.4 + t * 6.4, Math.sin(t * 7) * 0.5 + Math.cos(twist) * across, 1.2 - t * 4.5 + Math.sin(twist) * across, found === 10 && t > 0.9 ? 1 : 0];
});

// Static: no pattern at all.
const noise = (rand) => points(() => [(rand() * 2 - 1) * 3.4, (rand() * 2 - 1) * 2, (rand() * 2 - 1) * 2.4]);

// A wide surface seen from above, like a plate or still water. kind: its vibration.
// It runs from just in front of you to a far horizon, so it fills the lower half of the screen.
const SURFACE_Y = -0.85;
const SURFACE_W = 4.6;
const SURFACE_NEAR = 2;
const SURFACE_FAR = -7;
function surface(rand, swing) {
  return points(() => {
    const x = (rand() * 2 - 1) * SURFACE_W;
    const z = SURFACE_NEAR - rand() ** 0.8 * (SURFACE_NEAR - SURFACE_FAR);
    return [x, SURFACE_Y, z, ...swing(x, z)];
  });
}
// One standing wave, the calmest there is.
const standing = (rand) => surface(rand, (x) => [0, 0.42 * Math.sin(x * 0.9), 0]);
// Ripples spreading from the middle, reaching further with each lesson.
const ripple = (rand, lessons) => surface(rand, (x, z) => {
  const r = Math.hypot(x, z + 1.5);
  const reach = 0.8 + lessons * 0.6;
  return [0, 0.22 * Math.exp(-r * 0.18) * (r < reach ? 1 : 0.1), r * 3.2];
});
// A Chladni plate: the surface vibrating in a mode, with its still lines lit, like sand gathered on them.
const membrane = (rand, [n, m, sign]) => surface(rand, (x, z) => {
  const f = chladni(n, m, sign, x / SURFACE_W, ((z - SURFACE_FAR) / (SURFACE_NEAR - SURFACE_FAR)) * 2 - 1);
  return [Math.abs(f) < 0.08 ? 1 : 0, 0.32 * f, 0];
});

// A sphere of dust, its surface deformed like a 3D Chladni figure. [l, m]: the shape; d swings it in and out.
const SPHERE = 1.2;
const sphere = (rand, [l, m], depth) => points(() => {
  const z = rand() * 2 - 1;
  const phi = rand() * TAU;
  const s = Math.sqrt(1 - z * z);
  const theta = Math.acos(z);
  const shape = l ? Math.cos(m * phi) * Math.sin(theta) ** m * Math.cos(l * theta) : 0;
  return [s * Math.cos(phi) * SPHERE, s * Math.sin(phi) * SPHERE, z * SPHERE, 0, depth * shape, 0];
});

const LOOP_R = 1.4;
// The loop: two strands winding round a ring, with six bright points that light up one per line.
const loop = (rand, shown) => points((i) => {
  const u = rand() * TAU;
  if (i % 4 === 0) { // the six points
    const j = i % 24 / 4;
    const at = (j / 6) * TAU + gauss(rand) * 0.06;
    return [Math.cos(at) * LOOP_R + gauss(rand) * 0.06, Math.sin(at) * LOOP_R + gauss(rand) * 0.06, gauss(rand) * 0.06, j < shown ? 1 : 0];
  }
  const v = u * 9 + (i % 2) * Math.PI;
  const r = LOOP_R + Math.cos(v) * 0.32;
  return [Math.cos(u) * r, Math.sin(u) * r, Math.sin(v) * 0.32];
});

/* ---------- The beats ---------- */

// cam: where the camera looks from (pitch and yaw in radians, distance). axis: how a vibrating form moves.
const CAM = { front: { pitch: 0.2, yaw: 0, dist: 3.4 }, above: { pitch: 0.36, yaw: 0, dist: 3 }, wide: { pitch: 0.12, yaw: 0.35, dist: 3.6 } };
const beat = (key, build, hz, label, extra = {}) => ({ key, build, hz, label, amp: 0.25, cam: CAM.front, axis: 'y', omega: 0, spin: 0, ...extra });

// beat: 0-based, as on the page. step: how many of its lines have arrived, in reading order.
export function fieldFor(at, step) {
  switch (at) {
    case 0: return beat('ring', ring, 196, 'RING'); // I follow questions
    case 1: // what I found: drifting at first, then the wave reaches further with each thing
      return step === 0 ? beat('drift', drift, 220, 'DRIFT', { cam: CAM.wide, amp: 0.5 }) : beat(`ribbon${step}`, (r) => ribbon(r, step), 247, 'WAVE', { cam: CAM.wide });
    case 2: // it looks like changing direction (noise), but it was one thread (one standing wave)
      return step < 2 ? beat('noise', noise, 0, 'NOISE', { amp: 4, cam: CAM.wide }) : beat('standing', standing, 110, 'STANDING WAVE', { cam: CAM.above, omega: 1.6 });
    case 3: { // a ripple for each thing a field left behind; then they accumulate into one vibrating plate
      if (step <= 8) return beat(`ripple${Math.max(1, Math.min(step, 7))}`, (r) => ripple(r, Math.max(1, Math.min(step, 7))), 165, 'RIPPLE', { cam: CAM.above, omega: 2.4 });
      return beat('membrane', (r) => membrane(r, [3, 5, -1]), 220, 'MODE 3:5', { cam: CAM.above, omega: 2.2 });
    }
    case 4: { // the title, the tools, the questions change the sphere's shape; the behaviour holds it still
      if (step >= 4) return beat('still', (r) => sphere(r, [0, 0], 0), 440, 'HELD', { axis: 'radial', amp: 0.02 });
      const shape = [[2, 2], [3, 2], [4, 3], [5, 4]][step];
      return beat(`sphere${shape.join()}`, (r) => sphere(r, shape, 0.5), [262, 349, 392, 440][step], `SPHERE ${shape[0]}:${shape[1]}`, { axis: 'radial', omega: 1.8, spin: 0.15 });
    }
    default: // the loop, a point lit for each step; then back to the opening ring: only the next question
      return step <= 6 ? beat(`loop${step}`, (r) => loop(r, step), 196, 'LOOP', { spin: 0.25, cam: { pitch: 0.7, yaw: 0, dist: 3.4 } }) : beat('ring', ring, 196, 'RING');
  }
}

/* ---------- The dust ---------- */

// Forms that grow line by line, or share a surface, are built from the same random draws, so each point
// keeps its place and only what the line changes moves: the wave lengthens, the ripples reach further.
// A fresh draw per line would send every grain to a new spot each time, and the dust would never arrive.
const FAMILY = { standing: 'surface', ripple: 'surface', membrane: 'surface', still: 'sphere' };
function seedOf(key) {
  const base = key.replace(/[\d,]+$/, '');
  return [...(FAMILY[base] ?? base)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) | 0;
}

export function createDust(count, rand = Math.random) {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const glow = new Float32Array(count);
  const pace = new Float32Array(count); // each grain's own speed, so they never arrive together
  const order = new Uint32Array(count); // which point of a form each grain goes to
  const spread = new Float32Array(count * 3); // where it lies around that point, so grains sharing one don't stack
  for (let i = 0; i < count; i++) {
    pos.set([(rand() * 2 - 1) * 2.4, (rand() * 2 - 1) * 1.5, (rand() * 2 - 1) * 2], i * 3);
    spread.set([gauss(rand) * 0.02, gauss(rand) * 0.02, gauss(rand) * 0.02], i * 3);
    pace[i] = 0.5 + rand() * 0.9;
    order[i] = i;
  }
  for (let i = count - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }

  const built = new Map();
  let field = fieldFor(0, 0);
  let pts = null;
  let turned = 0;
  let clock = 0;

  const dust = {
    pos,
    glow,
    get field() { return field; },
    set(next) {
      field = next;
      if (!built.has(next.key)) built.set(next.key, next.build(seeded(seedOf(next.key))));
      pts = built.get(next.key);
    },
    // dt in seconds; shake: extra restlessness from the music.
    step(dt, shake = 0) {
      const k = Math.min(dt, 0.05);
      clock += k;
      const keep = DAMP ** (k * 60);
      const amp = field.amp + shake;
      turned += field.spin * k;
      const cos = Math.cos(turned);
      const sin = Math.sin(turned);
      const radial = field.axis === 'radial';
      const wt = field.omega * clock;
      const P = pts.length / 6;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const p = (order[i] % P) * 6;
        const swing = pts[p + 4] * Math.cos(wt - pts[p + 5]);
        let tx = pts[p];
        let ty = pts[p + 1];
        let tz = pts[p + 2];
        if (radial) { tx *= 1 + swing; ty *= 1 + swing; tz *= 1 + swing; } else ty += swing;
        const rx = tx * cos - ty * sin;
        const ry = tx * sin + ty * cos;
        tx = rx + spread[ix];
        ty = ry + spread[ix + 1];
        tz += spread[ix + 2];
        const x = pos[ix];
        const y = pos[ix + 1];
        const z = pos[ix + 2];
        const ax = (tx - x) * SPRING + (Math.random() - 0.5) * amp + Math.sin(y * 2.1 + clock * 0.7) * SWIRL;
        const ay = (ty - y) * SPRING + (Math.random() - 0.5) * amp + Math.sin(z * 2.3 + clock * 0.6) * SWIRL;
        const az = (tz - z) * SPRING + (Math.random() - 0.5) * amp + Math.sin(x * 1.9 + clock * 0.5) * SWIRL;
        let vx = (vel[ix] + ax * k * pace[i]) * keep;
        let vy = (vel[ix + 1] + ay * k * pace[i]) * keep;
        let vz = (vel[ix + 2] + az * k * pace[i]) * keep;
        const speed = Math.hypot(vx, vy, vz);
        const cap = MAX_SPEED * pace[i];
        if (speed > cap) { vx *= cap / speed; vy *= cap / speed; vz *= cap / speed; }
        pos[ix] = x + vx * k;
        pos[ix + 1] = y + vy * k;
        pos[ix + 2] = z + vz * k;
        vel[ix] = vx;
        vel[ix + 1] = vy;
        vel[ix + 2] = vz;
        const crest = Math.max(0, swing) * (radial ? 2.4 : 2.8); // the crests of a vibrating form catch the light
        glow[i] += (Math.max(pts[p + 3], Math.min(1, crest)) - glow[i]) * Math.min(1, k * 4);
      }
    },
  };
  dust.set(field);
  return dust;
}

// A quick self-check: every form is finite and in a sane box, and dust settles onto a still form.
export function selfCheck() {
  for (let at = 0; at < 6; at++) for (let step = 0; step <= 10; step++) {
    const f = fieldFor(at, step);
    const pts = f.build(seeded(1));
    for (let i = 0; i < pts.length; i++) if (!Number.isFinite(pts[i]) || (i % 6 < 3 && Math.abs(pts[i]) > 12)) throw new Error(`${f.key} wrote ${pts[i]}`);
  }
  const dust = createDust(500, seeded(2));
  dust.set({ ...fieldFor(0, 0), amp: 0 });
  for (let s = 0; s < 600; s++) dust.step(1 / 60);
  let onRing = 0; // 11 in 12 of the ring's points are on it; the rest are dust around it
  for (let i = 0; i < 500; i++) if (Math.abs(Math.hypot(dust.pos[i * 3], dust.pos[i * 3 + 1]) - RING) < 0.25 && Math.abs(dust.pos[i * 3 + 2]) < 0.3) onRing++;
  if (onRing < 400) throw new Error(`dust didn't settle onto the ring: ${onRing}/500`);
  return true;
}
