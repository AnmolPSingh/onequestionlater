// Whales in ink tiles, swimming behind the contact details on the white close. Each whale wanders on a
// smooth, curving course at any angle, and its body follows the path its head took, so it bends through
// a turn like a real animal; the flukes beat up and down as it goes, and when it turns back the other way
// it rolls over rather than flipping. Every frame the whales are painted as soft shaded silhouettes into
// a tiny canvas, one pixel per cell, and each cell is drawn as an ink tile, with a flickering glyph where
// the body is dense. They steer away from the pointer, the cells under it scramble, and behind the words
// everything fades, so the words always read first.
const INK = '13 12 11';
const CELL = innerWidth < 640 ? 9 : 12; // px per tile
const GLYPHS = '0123456789@#%&SX8';
const TILE_ALPHA = 0.3;
const GLYPH_ALPHA = 0.5;
const GRID_ALPHA = 0.06; // the faint grid of dots the whales swim through
const STROKE_SECONDS = 5.5; // one beat of the flukes
const WAVE = 0.03; // of body length, how far the flukes sweep
const SPEED = 0.07; // body lengths a second
const TURN_RADIUS = 0.6; // body lengths: the tightest circle a whale turns in, so it bends but never folds
const ROLL_SECONDS = 1.6; // how long rolling over takes
const SHY_RADIUS = 260; // px from the head at which a whale turns away from the pointer
const SCRAMBLE_RADIUS = 80; // px around the pointer where glyphs scramble
const BEHIND_TEXT = 0.3; // what's left of a cell behind the words
const FLICKER_MS = 140; // how often a glyph may change

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// The side profile in shares of body length: + is belly, - is back. A blunt flat-topped head, the deep
// pleated throat a fifth back, then a long thinning tail stock and the flukes.
const STOCK = 0.88;
const taper = (s, from) => (s < from ? 1 : 1 - ((s - from) / (STOCK - from)) ** 1.25 * 0.86);
const FULL = 1.25; // a touch fuller than life, so the shape still reads in coarse tiles
const back = (s) => -0.06 * FULL * Math.min(1, (s / 0.1) ** 0.55) * taper(s, 0.55);
const belly = (s) => 0.085 * FULL * Math.min(1, (s / 0.22) ** 0.75) * taper(s, 0.42);
const STEPS = 36;
const PROFILE = Array.from({ length: STEPS + 1 }, (_, i) => (i / STEPS) * STOCK);
const PECTORAL = [[0.24, belly(0.24) - 0.004], [0.36, belly(0.24) + 0.05], [0.3, belly(0.3) - 0.002]];
const DORSAL = [[0.72, back(0.72)], [0.765, back(0.75) - 0.018], [0.79, back(0.79)]];
const FLUKES = [[STOCK, -0.014], [1, -0.085], [0.965, 0], [1, 0.085], [STOCK, 0.014]];

// A point a given distance back along a trail of points (newest first), with the direction of travel there.
export function along(trail, distance) {
  let left = distance;
  for (let i = 0; i < trail.length - 1; i++) {
    const [ax, ay] = trail[i];
    const [bx, by] = trail[i + 1];
    const seg = Math.hypot(ax - bx, ay - by) || 1e-6;
    const tx = (ax - bx) / seg;
    const ty = (ay - by) / seg;
    if (left <= seg) return [ax - tx * left, ay - ty * left, tx, ty];
    left -= seg;
  }
  const n = trail.length;
  const [ax, ay] = trail[n - 1];
  const [bx, by] = n > 1 ? trail[n - 2] : [ax + 1, ay];
  const seg = Math.hypot(bx - ax, by - ay) || 1;
  const tx = (bx - ax) / seg;
  const ty = (by - ay) / seg;
  return [ax - tx * left, ay - ty * left, tx, ty]; // past the end of the trail the body carries straight on
}

function spawn(w, h, length, depth, heading, x, y) {
  const trail = [];
  for (let d = 0; d <= length * 1.3; d += 6) trail.push([x - Math.cos(heading) * d, y - Math.sin(heading) * d]);
  return { length, depth, heading, x, y, trail, roll: Math.cos(heading) >= 0 ? 1 : -1, phase: Math.random() * 100, flee: 0 };
}

export function createWhale(layer, words) {
  const canvas = document.createElement('canvas');
  canvas.className = 'whale';
  canvas.setAttribute('aria-hidden', 'true');
  layer.append(canvas);
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas'); // one pixel per cell: the whales' shading, read back each frame
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  const grid = document.createElement('canvas');
  let w = 0;
  let h = 0;
  let cols = 0;
  let rows = 0;
  let whales = [];
  let last = 0;

  const size = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cols = Math.ceil(w / CELL);
    rows = Math.ceil(h / CELL);
    mask.width = cols;
    mask.height = rows;
    grid.width = canvas.width;
    grid.height = canvas.height;
    const g = grid.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.fillStyle = `rgb(${INK} / ${GRID_ALPHA})`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.fillRect(c * CELL + CELL / 2 - 0.5, r * CELL + CELL / 2 - 0.5, 1, 1);
    if (!whales.length) {
      const big = Math.min(w * (w < 640 ? 1.1 : 0.85), 1200); // big enough to fill many tiles, as in the reference
      whales = [spawn(w, h, big, 1, 0.12, w * 0.7, h * 0.76)];
      if (w >= 640) whales.push(spawn(w, h, big * 0.5, 0.55, Math.PI + 0.25, w * 0.35, h * 0.2)); // a smaller one, further off
    }
  };
  size();
  addEventListener('resize', size, { passive: true });

  // Steer: wander on a slow, smooth course, come back when wandering too far off screen, and turn away from
  // the pointer. The body then follows the trail its head leaves.
  const swim = (whale, t, dt, pointer) => {
    const { length } = whale;
    const speed = SPEED * length * (1 + whale.flee * 0.8);
    const TURN = speed / (TURN_RADIUS * length); // the sharpest turn this whale can make at this speed
    let turn = (Math.sin(t * 0.13 + whale.phase) * 0.6 + Math.sin(t * 0.051 + whale.phase * 1.7) * 0.4) * TURN;
    const margin = length * 0.35;
    if (whale.x < -margin || whale.x > w + margin || whale.y < -margin * 0.6 || whale.y > h + margin * 0.6) {
      const home = Math.atan2(h / 2 - whale.y, w / 2 - whale.x);
      turn = Math.sign(Math.sin(home - whale.heading)) * TURN;
    }
    if (pointer) {
      const dx = pointer[0] - whale.x;
      const dy = pointer[1] - whale.y;
      const near = clamp(1 - Math.hypot(dx, dy) / SHY_RADIUS);
      if (near) turn = -Math.sign(Math.sin(Math.atan2(dy, dx) - whale.heading)) * TURN;
      whale.flee += (near - whale.flee) * 0.05;
    } else whale.flee *= 0.97;
    whale.heading += clamp(turn, -TURN, TURN) * dt;
    whale.x += Math.cos(whale.heading) * speed * dt;
    whale.y += Math.sin(whale.heading) * speed * dt;
    const [hx, hy] = whale.trail[0];
    if (Math.hypot(whale.x - hx, whale.y - hy) > 4) whale.trail.unshift([whale.x, whale.y]);
    else whale.trail[0] = [whale.x, whale.y];
    while (whale.trail.length > 4 && (whale.trail.length - 1) * 4 > length * 1.4) whale.trail.pop();
    // Rolls over when its heading turns from rightward to leftward; the middle of the roll is seen from above.
    const cos = Math.cos(whale.heading);
    if (Math.abs(cos) > 0.25) whale.roll += (Math.sign(cos) - whale.roll) * clamp(dt * (2 / ROLL_SECONDS));
  };

  // Where a point of the profile (s along the body, y across it) lands on screen, following the trail.
  const place = (whale, beat, s, y) => {
    const [cx, cy, tx, ty] = along(whale.trail, s * whale.length);
    const sweep = WAVE * (0.08 + s * s * 1.6) * Math.sin(beat - s * 4.2);
    const across = -(y + sweep) * whale.length * whale.roll;
    return [cx + ty * across, cy - tx * across];
  };

  const paint = (whale, beat) => {
    const shape = (points) => {
      mctx.beginPath();
      points.forEach(([s, y], i) => { const [px, py] = place(whale, beat, s, y); if (i) mctx.lineTo(px, py); else mctx.moveTo(px, py); });
      mctx.closePath();
      mctx.fill();
    };
    const top = PROFILE.map((s) => [s, back(s)]);
    const under = PROFILE.map((s) => [s, belly(s)]).reverse();
    const middle = PROFILE.map((s) => [s, (back(s) + belly(s)) * 0.35]).reverse();
    mctx.fillStyle = `rgba(0,0,0,${0.5 * whale.depth})`; // the whole body
    shape([...top, ...under]);
    mctx.fillStyle = `rgba(0,0,0,${0.35 * whale.depth})`; // the back darker than the belly
    shape([...top, ...middle]);
    mctx.fillStyle = `rgba(0,0,0,${0.55 * whale.depth})`;
    shape(PECTORAL);
    shape(DORSAL);
    shape(FLUKES);
  };

  return {
    draw(now, pointer) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const t = now / 1000;
      const beat = (t / STROKE_SECONDS) * Math.PI * 2;

      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(0, 0, cols, rows);
      mctx.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0);
      for (const whale of whales) { swim(whale, t, dt, pointer); paint(whale, beat + whale.phase); }
      const cells = mctx.getImageData(0, 0, cols, rows).data;

      // Behind the words, a cell keeps only a little of its ink.
      const boxes = words.map((el) => el.getBoundingClientRect()).filter((r) => r.height).map((r) => [r.left - 30, r.top - 20, r.right + 30, r.bottom + 20]);
      const flicker = Math.floor(now / FLICKER_MS);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(grid, 0, 0, w, h);
      ctx.font = `500 ${Math.round(CELL * 0.72)}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let v = cells[(r * cols + c) * 4 + 3] / 255;
          if (v < 0.04) continue;
          const x = c * CELL;
          const y = r * CELL;
          const mx = x + CELL / 2;
          const my = y + CELL / 2;
          if (boxes.some(([l, tp, rt, b]) => mx > l && mx < rt && my > tp && my < b)) v *= BEHIND_TEXT;
          const stirred = pointer && Math.hypot(mx - pointer[0], my - pointer[1]) < SCRAMBLE_RADIUS;
          ctx.fillStyle = `rgb(${INK} / ${(v * TILE_ALPHA).toFixed(3)})`;
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          if (v < 0.28) continue;
          // Each cell's glyph changes now and then, more often where the pointer stirs it.
          const seed = (c * 73856093) ^ (r * 19349663) ^ (stirred ? Math.floor(now / 40) : Math.floor(flicker / (1 + ((c * 7 + r * 13) % 5))));
          ctx.fillStyle = `rgb(${INK} / ${Math.min(0.8, v * GLYPH_ALPHA + (stirred ? 0.15 : 0)).toFixed(3)})`;
          ctx.fillText(GLYPHS[Math.abs(seed) % GLYPHS.length], mx, my + 0.5);
        }
      }
    },
  };
}

// A quick self-check: walking a trail lands on it, and past its end the body carries straight on.
export function selfCheck() {
  const trail = [[100, 0], [50, 0], [0, 0]];
  const [x1, y1, tx] = along(trail, 30);
  if (Math.abs(x1 - 70) > 1e-6 || y1 !== 0 || tx !== 1) throw new Error(`along: ${x1}, ${y1}, ${tx}`);
  const [x2] = along(trail, 130);
  if (Math.abs(x2 + 30) > 1e-6) throw new Error(`past the end: ${x2}`);
  return true;
}
