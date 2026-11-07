// What I found, inside my head. A slow cloud of points turns where my brain is, drawn like the bust's own
// dots: lines form between the near ones and let go, it gathers into a knot and loosens again, and some of
// the points are small pictures of the things I found. When a field's pictures come round to the front,
// its name in the list lights. The names stay real text in the list; this canvas only draws on the bust.
// The photos are free Unsplash ones, four a field, graded to the palette (assets-src/found/credits.tsv).
const ATLAS = { src: '/found/atlas.webp', cell: 80, cols: 6, perField: 4 };
const POINTS = 130;
const PICTURES_PER_FIELD = 3;
const RINGS = 2; // hoops of points that drift through, as in the reference's loose phase
const RING_POINTS = 16;
const TURN = 46; // seconds per turn of the cloud
const BREATHE = 15; // seconds from knot to loose and back
const LINK = 0.34; // in brain radii: points nearer than this may join
const CAMERA = 3.2; // perspective, in brain radii
const ARRIVE = 2.2; // seconds the cloud takes to open out of the middle of my head
const PAPER = '243,238,228';
const ONAIR = '255,138,42';

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => v * v * (3 - 2 * v);

// Points in a brain-shaped volume: wider than tall, a little deeper than wide.
function build(fields) {
  const rand = seeded(11);
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const inBrain = () => {
    for (;;) {
      const p = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
      if (p[0] ** 2 + (p[1] / 0.78) ** 2 + (p[2] / 1.1) ** 2 <= 1) return [p[0], p[1] * 0.78, p[2] * 1.1];
    }
  };
  const point = (loose) => ({
    knot: [gauss() * 0.55, gauss() * 0.42, gauss() * 0.55],
    loose,
    phase: rand(),
    size: rand() < 0.08 ? 1.8 : 0.8 + rand() * 0.6, // mostly dust, the odd bigger star, like the bust
    hot: rand() < 0.04,
  });
  const points = Array.from({ length: POINTS }, () => point(inBrain()));
  for (let r = 0; r < RINGS; r++) {
    const c = inBrain().map((v) => v * 0.6);
    const radius = 0.2 + rand() * 0.12;
    const a = rand() * Math.PI;
    const b = rand() * Math.PI;
    for (let i = 0; i < RING_POINTS; i++) {
      const t = (i / RING_POINTS) * Math.PI * 2;
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * radius;
      const ring = point([c[0] + x * Math.cos(a), c[1] + y * Math.cos(b), c[2] + x * Math.sin(a) + y * Math.sin(b)]);
      ring.ring = true;
      ring.phase = r * 0.5 + 0.25; // a hoop holds together while it's out
      points.push(ring);
    }
  }
  const pictures = [];
  fields.forEach((_, field) => {
    for (let i = 0; i < PICTURES_PER_FIELD; i++) {
      const p = points[Math.floor(rand() * POINTS)];
      if (p.picture) { i--; continue; }
      p.knot = p.loose.map((v) => v * 0.55); // pictures never crowd into the knot, so they stay readable
      const photo = field * ATLAS.perField + Math.floor(rand() * ATLAS.perField);
      const crop = 40 + rand() * 40; // a detail of the photo, not all of it
      p.picture = {
        field,
        size: 9 + rand() * 9, // px at the front; small on purpose
        sx: (photo % ATLAS.cols) * ATLAS.cell + rand() * (ATLAS.cell - crop),
        sy: Math.floor(photo / ATLAS.cols) * ATLAS.cell + rand() * (ATLAS.cell - crop),
        crop,
      };
      pictures.push(p);
    }
  });
  return { points, pictures, seed: points.map(() => rand()) };
}

export function startFound(box) {
  const words = [...box.querySelectorAll('li')];
  const canvas = document.createElement('canvas');
  canvas.className = 'found-burst';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas); // after the scene's canvas, so it draws on the bust and under the text
  const ctx = canvas.getContext('2d');
  const atlas = new Image();
  let atlasReady = false;
  let atlasAsked = false;
  const cloud = build(words);
  let startAt = -1;
  let painted = false;
  let lit = words.map(() => -1);

  const layout = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    painted = true; // force a clear on the next quiet frame
  };

  const lightWords = (levels) => {
    words.forEach((li, i) => {
      const v = Math.round(levels[i] * 20) / 20;
      if (lit[i] === v) return;
      li.style.opacity = String(v);
      lit[i] = v;
    });
  };

  // brain: [x, y, radius] of my brain on screen, in px. on: whether the list is in play.
  const draw = (time, brain, on) => {
    if (!on) {
      startAt = -1;
      if (painted) { ctx.clearRect(0, 0, innerWidth, innerHeight); lightWords(words.map(() => 0)); painted = false; }
      return;
    }
    if (!atlasAsked) {
      atlasAsked = true;
      atlas.onload = () => { atlasReady = true; };
      atlas.onerror = () => console.warn('Found atlas unavailable; the cloud draws without its pictures.');
      atlas.src = ATLAS.src;
    }
    if (startAt < 0) startAt = time;
    painted = true;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const [bx, by, br] = brain;
    const t = time - startAt;
    const arrive = smooth(clamp(t / ARRIVE));

    // Turn, with a slow nod, then project. Everything is in brain radii until the last step.
    const yaw = (time / TURN) * Math.PI * 2;
    const pitch = 0.32 + Math.sin(time * 0.07) * 0.12;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const breathe = (time / BREATHE) * Math.PI * 2;
    const placed = cloud.points.map((p) => {
      const loose = smooth(0.5 + 0.5 * Math.sin(breathe + p.phase * 2.4));
      const x0 = (p.knot[0] + (p.loose[0] - p.knot[0]) * loose) * arrive;
      const y0 = (p.knot[1] + (p.loose[1] - p.knot[1]) * loose) * arrive;
      const z0 = (p.knot[2] + (p.loose[2] - p.knot[2]) * loose) * arrive;
      const x1 = cy * x0 + sy * z0;
      const z1 = -sy * x0 + cy * z0;
      const y = cp * y0 - sp * z1;
      const z = sp * y0 + cp * z1;
      const s = CAMERA / (CAMERA - z);
      const front = clamp((z + 1) / 2); // 0 at the back of my head, 1 at the front
      return { p, x: x0, y: y0, z: z0, sx: bx + x1 * s * br, sy: by - y * s * br, s, front, loose };
    });

    // A faint warmth behind the knot, the way the bust's dots glow where they crowd.
    const knot = 1 - placed.reduce((a, q) => a + q.loose, 0) / placed.length;
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, br * 0.9);
    glow.addColorStop(0, `rgba(${PAPER},${(0.03 + knot * 0.05) * arrive})`);
    glow.addColorStop(1, `rgba(${PAPER},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);

    // Lines between near points. Each pair has its own slow beat, so links form and let go.
    ctx.lineWidth = 0.9;
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      if (a.p.ring) continue;
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j];
        if (b.p.ring) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d > LINK) continue;
        const beat = Math.sin(time * (0.35 + cloud.seed[i] * 0.4) + cloud.seed[j] * 40);
        if (beat < 0.1) continue;
        const alpha = (1 - d / LINK) * smooth(clamp((beat - 0.1) / 0.4)) * (0.4 + 0.6 * Math.min(a.front, b.front)) * (0.45 + 0.55 * Math.min(a.loose, b.loose)) * arrive;
        ctx.strokeStyle = `rgba(${PAPER},${alpha.toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
    }

    // The points, back to front, as soft round dots like the bust's.
    const order = placed.slice().sort((a, b) => a.z - b.z);
    order.forEach((q) => {
      const r = q.p.size * q.s * 0.9;
      const alpha = (0.25 + 0.75 * q.front) * (0.4 + 0.6 * q.loose) * arrive * (q.p.ring ? q.loose : 1); // crowded dots dim, so the knot reads as lines, not a smudge
      const dot = ctx.createRadialGradient(q.sx, q.sy, 0, q.sx, q.sy, r * 1.8);
      dot.addColorStop(0, `rgba(${q.p.hot ? ONAIR : PAPER},${alpha.toFixed(3)})`);
      dot.addColorStop(1, `rgba(${q.p.hot ? ONAIR : PAPER},0)`);
      ctx.fillStyle = dot;
      ctx.fillRect(q.sx - r * 1.8, q.sy - r * 1.8, r * 3.6, r * 3.6);
      const pic = q.p.picture;
      if (!pic) return;
      const size = pic.size * q.s * (0.55 + 0.45 * q.front);
      ctx.globalAlpha = (0.3 + 0.7 * q.front) * arrive;
      if (atlasReady) ctx.drawImage(atlas, pic.sx, pic.sy, pic.crop, pic.crop, q.sx - size / 2, q.sy - size / 2, size, size);
      ctx.strokeStyle = `rgba(${PAPER},0.35)`;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(q.sx - size / 2, q.sy - size / 2, size, size);
      ctx.globalAlpha = 1;
    });

    // A name lights while one of its pictures is facing you.
    const levels = words.map(() => 0);
    placed.forEach((q) => { if (q.p.picture) levels[q.p.picture.field] = Math.max(levels[q.p.picture.field], q.front); });
    lightWords(levels.map((f) => (0.35 + 0.65 * smooth(clamp((f - 0.55) / 0.35))) * arrive));
  };

  return { layout, draw };
}
