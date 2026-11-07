// A blue whale in faint ink dots, swimming behind the contact details on the white close. Its body is
// sampled once in its own frame (0 at the snout, 1 at the fluke tips); every frame a slow wave runs
// down it, strongest at the flukes, and the whole body glides along a drifting path. Off one edge it
// turns unseen and comes back the other way. Dots near the pointer part around it and drift back, and
// if the pointer comes near its head the whale dips away. Behind the words it fades further, so they
// always read first.
const INK = '13 12 11';
const STROKE_SECONDS = 5.5; // one beat of the flukes
const WAVE = 0.032; // of body length, how far the tail sweeps up and down
const SPEED = 0.055; // body lengths a second
const OFFSTAGE_SECONDS = 4; // unseen, turning, before it comes back
const PART_RADIUS = 110; // px around the pointer that the dots make room
const SHY_RADIUS = 240; // px from the head at which the whale starts to dip away
const BEHIND_TEXT = 0.4; // dots behind the words keep this share of their ink
const DUST = 70;
const INK_ALPHA = 0.42; // the darkest dot; most sit well under it
const LANES = [0.21, 0.79]; // shares of the height above and below the words, where it cruises

const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// The side profile, as shares of the body's length below (+) and above (-) the line from snout to
// tail: a blunt, flat-topped head, the deep pleated throat a fifth back, then a long thinning tail stock.
const STOCK = 0.88; // where the flukes begin
const taper = (s, from) => (s < from ? 1 : 1 - ((s - from) / (STOCK - from)) ** 1.25 * 0.86);
const top = (s) => -0.06 * Math.min(1, (s / 0.1) ** 0.55) * taper(s, 0.55);
const belly = (s) => 0.085 * Math.min(1, (s / 0.22) ** 0.75) * taper(s, 0.42);

function body(count) {
  const dots = [];
  const add = (s, y, alpha, size) => dots.push({ s, y, alpha, size, ox: 0, oy: 0, vx: 0, vy: 0 });
  for (let i = 0; i < count; i++) {
    const pick = i / count;
    if (pick < 0.36) { // the body's fill: sparse, with a pale band along the flank like light on the skin
      const s = rand(STOCK);
      const band = Math.random() < 0.35;
      const v = band ? 0.38 + rand(0.08, -0.08) : rand();
      add(s, top(s) + v * (belly(s) - top(s)), band ? rand(0.75, 0.4) : 0.12 + 0.5 * Math.abs(v - 0.5) ** 1.5, rand(1.2, 0.6));
      continue;
    }
    if (pick < 0.74) { // the outline, back and belly, where the shape is read
      const s = rand(STOCK);
      add(s, (Math.random() < 0.48 ? top(s) : belly(s)) + rand(0.003, -0.003), rand(1, 0.55), rand(1.7, 0.9));
      continue;
    }
    if (pick < 0.85) { // the flukes, two swept lobes either side of a notch
      const u = rand() ** 0.8;
      const lobe = Math.random() < 0.55 ? -1 : 1;
      const lead = lobe * (0.01 + 0.062 * u ** 1.1);
      const notch = lobe * 0.05 * u ** 3;
      const edge = Math.random() < 0.6;
      add(STOCK + 0.12 * u, edge ? lead : notch + rand() * (lead - notch), edge ? rand(1, 0.55) : rand(0.5, 0.15), rand(1.5, 0.7));
      continue;
    }
    if (pick < 0.9) { // the pectoral fin, short and slim, angled back from under the chest
      const u = rand();
      const s = 0.24 + u * 0.11;
      add(s, belly(0.24) + u * 0.045 + rand(0.012 * (1 - u), -0.004 * (1 - u)), rand(0.8, 0.35), rand(1.3, 0.7));
      continue;
    }
    if (pick < 0.92) { // a small dorsal fin, far back
      const u = rand();
      add(0.73 + u * 0.05, top(0.73 + u * 0.05) - 0.016 * (1 - Math.abs(u - 0.35) / 0.65) * rand(), rand(0.8, 0.4), rand(1.3, 0.7));
      continue;
    }
    if (pick < 0.95) { // the mouth line, curving down from the snout, and the eye just behind it
      const s = rand(0.17, 0.01);
      if (Math.random() < 0.12) add(0.155 + rand(0.006), 0.012 + rand(0.006), 0.9, rand(1.6, 1));
      else add(s, 0.004 + 0.12 * s * s / 0.17, rand(0.8, 0.4), rand(1.2, 0.7));
      continue;
    }
    // The throat pleats, running back along the belly.
    const s = rand(0.46, 0.05);
    const row = 1 + Math.floor(rand(4));
    add(s, belly(s) - row * 0.012 * Math.min(1, s / 0.2), rand(0.55, 0.2), rand(1, 0.6));
  }
  return dots;
}

export function createWhale(layer, words) {
  const canvas = document.createElement('canvas');
  canvas.className = 'whale';
  canvas.setAttribute('aria-hidden', 'true');
  layer.append(canvas);
  const ctx = canvas.getContext('2d');
  const dots = body(innerWidth < 640 ? 900 : 1600);
  const dust = [];
  let w = 0;
  let h = 0;
  let length = 0;
  let dir = 1;
  let x = 0; // the snout, in px
  let lane = LANES[1]; // share of the height the whale cruises at
  let shy = 0;
  let away = 0;
  let last = 0;
  let pitch = 0;
  let prevY = null;

  const size = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    length = Math.min(w * (w < 640 ? 0.9 : 0.55), 820);
  };
  size();
  addEventListener('resize', size, { passive: true });
  x = w * 0.66; // the first time the white comes up, the whole whale is already there

  return {
    draw(now, pointer) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const t = now / 1000;

      // Swim: forward along a drifting lane, and once wholly off one side, turn unseen and come back.
      x += dir * SPEED * length * dt;
      const gone = dir > 0 ? x - length > w + 40 : x + length < -40;
      if (gone) {
        away += dt;
        if (away > OFFSTAGE_SECONDS) {
          away = 0;
          dir = -dir;
          lane = LANES[Math.round(Math.random())];
          x = dir > 0 ? -40 : w + 40;
        }
      }
      const head = [x, h * (lane + 0.035 * Math.sin(t * 0.11) + 0.015 * Math.sin(t * 0.27 + 1.3))];
      if (pointer) {
        const dx = pointer[0] - head[0];
        const dy = pointer[1] - head[1];
        const near = clamp(1 - Math.hypot(dx, dy) / SHY_RADIUS);
        shy += ((near ? -Math.sign(dy || 1) * near * 0.09 * h : 0) - shy) * 0.02;
      } else shy *= 0.98;
      head[1] += shy;
      if (prevY !== null && dt) pitch += (clamp(Math.atan2(head[1] - prevY, SPEED * length * dt) * 0.8, -0.18, 0.18) - pitch) * 0.04;
      prevY = head[1];

      // Where the words are, so the dots behind them stay quieter.
      const boxes = words.map((el) => el.getBoundingClientRect()).filter((r) => r.height);
      const cos = Math.cos(pitch * dir);
      const sin = Math.sin(pitch * dir);
      const beat = (t / STROKE_SECONDS) * Math.PI * 2;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgb(${INK})`;
      for (const d of dots) {
        // The wave runs from the chest to the flukes, growing as it goes.
        const sweep = WAVE * (0.08 + d.s * d.s * 1.6) * Math.sin(beat - d.s * 4.2);
        const lx = -dir * d.s * length;
        const ly = (d.y + sweep) * length;
        let px = head[0] + lx * cos - ly * sin;
        let py = head[1] + lx * sin + ly * cos;
        if (pointer) {
          const dx = px + d.ox - pointer[0];
          const dy = py + d.oy - pointer[1];
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < PART_RADIUS) {
            const push = (1 - dist / PART_RADIUS) ** 2 * 1.6;
            d.vx += (dx / dist) * push;
            d.vy += (dy / dist) * push;
          }
        }
        d.vx = (d.vx - d.ox * 0.035) * 0.86;
        d.vy = (d.vy - d.oy * 0.035) * 0.86;
        d.ox += d.vx;
        d.oy += d.vy;
        px += d.ox;
        py += d.oy;
        if (px < -4 || px > w + 4 || py < -4 || py > h + 4) continue;
        const behind = boxes.some((r) => px > r.left && px < r.right && py > r.top && py < r.bottom);
        ctx.globalAlpha = d.alpha * INK_ALPHA * (behind ? BEHIND_TEXT : 1);
        ctx.fillRect(px, py, d.size, d.size);
        if (d.s > 0.9 && dust.length < DUST && Math.random() < 0.0025) dust.push({ x: px, y: py, vx: -dir * rand(6, 2), vy: rand(4, -4), life: 0 });
      }

      // A little dust shed by the flukes, drifting off and fading.
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i];
        p.life += dt / 3;
        if (p.life >= 1) { dust.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = INK_ALPHA * 0.5 * (1 - p.life);
        ctx.fillRect(p.x, p.y, 1, 1);
      }
      ctx.globalAlpha = 1;
    },
  };
}

// A quick self-check: every dot sits inside a sane box around the body.
export function selfCheck() {
  for (const d of body(2000)) if (!(d.s >= 0 && d.s <= 1 && Math.abs(d.y) < 0.2 && d.alpha > 0)) throw new Error(`stray dot ${JSON.stringify(d)}`);
  return true;
}
