// Every shape is a Float32Array of vec4 per particle: x, y, z in scene units (y runs -1..1,
// x runs -aspect..aspect) and w = behaviour code + alpha * 0.9. All shapes have the same
// count, so the scene can morph any particle from one shape to the next.
const STILL = 0;
const GLOBE = 2;
const FIELD = 4;
const HOT = 5;
const STATIC = 6;
const SIGNAL = 7;
const VIEW = 12; // me, as one of the reference views in dots: lit like Elimar, placed by the conductor, turned by flowing to the next view
const TUNNEL = 9; // stars streaming past the camera as the scroll flies forward
const LANDSCAPE = 10; // the desert, each dot at its own depth, so the camera can walk into it
const FIGURE = 11; // me in that desert: the wind blows past, and these dots only shimmer in place

const LAND_W = 360;
const LAND_H = 180;
const GLOBE_RADIUS = 0.74;
// [lat, lon]. Where I work from and with; I move to where I'm needed.
const DELHI = [28.6, 77.2];
const MUMBAI = [19.1, 72.9];
const LONDON = [51.5, -0.1];
const EDINBURGH = [55.95, -3.2];
const SYDNEY = [-33.9, 151.2];
const MELBOURNE = [-37.8, 145];
const NEW_YORK = [40.7, -74];
const SAN_FRANCISCO = [37.8, -122.4];

const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const write = (out, i, x, y, z, code, alpha) => {
  out[i * 4] = x;
  out[i * 4 + 1] = y;
  out[i * 4 + 2] = z;
  out[i * 4 + 3] = code + alpha * 0.9;
};

// Where the portrait forms from: a cloud well outside the screen, as if it blew in.
export function cloud(n) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2);
    const b = Math.acos(rand(1, -1));
    const r = rand(5, 1.6);
    write(out, i, Math.sin(b) * Math.cos(a) * r, Math.sin(b) * Math.sin(a) * r, Math.cos(b) * Math.min(r, 1.6), FIELD, rand(0.4, 0.05));
  }
  return out;
}

// The loader's last photo as dots, lying where it was on screen, so it can break up into the portrait.
// Half the particles draw it; the rest wait in the cloud. corners: the photo's top-left and
// bottom-right in scene units.
export function photo(n, { width, height, luma }, [[x0, y0], [x1, y1]]) {
  const out = cloud(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.random();
    const v = Math.random();
    const l = luma[Math.floor(v * height) * width + Math.floor(u * width)];
    write(out, i, x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, 0, STILL, 0.1 + 0.9 * l);
  }
  return out;
}

// The figure turns about its own centre line, this far down the frame: the head, so a turn feels
// like a head turning.
export const HEAD_PIVOT = 0.33;

// Reads public/hero/views.bin from scripts/make-views.py: for each view (front, then slant), Uint16
// u, v, luma per dot. Dot i is on the same part of me in both, so a turn flows each dot sideways.
export function readViews(buffer, views = 2) {
  const all = new Uint16Array(buffer);
  const count = all.length / 3 / views;
  return { count, views: Array.from({ length: views }, (_, k) => all.subarray(k * count * 3, (k + 1) * count * 3)) };
}

// One view of me in dots. box: the hero frame in scene units; the square view spans its width, so the
// shoulders run off the bottom.
export function portrait(n, { count, views }, view, box) {
  const out = new Float32Array(n * 4);
  const dots = views[view];
  const used = Math.min(Math.floor(n * 0.94), count); // the rest are faint stars far behind the figure
  for (let i = 0; i < n; i++) {
    if (i >= used) { write(out, i, rand(2.4, -2.4), rand(1.4, -1.4), -1.2, FIELD, rand(0.22, 0.05)); continue; }
    const j = Math.floor((i * count) / used) * 3; // evenly through the whole figure: the dots are stored top to bottom
    const u = dots[j] / 65535 - 0.5;
    const v = dots[j + 1] / 65535;
    const luma = dots[j + 2] / 65535;
    write(out, i, u * box.w, HEAD_PIVOT * box.h - v * box.w, 0, VIEW, 0.08 + luma * 0.82);
  }
  return out;
}

export const DESERT = { ratio: 1.6, axis: 0.4127, focus: [0.78, 0.235] }; // focus: the bright edge of the horizon, where the walk ends

// frame: the scene's rectangle in scene units, cover-fitted to the screen. Depth stays in z, 0 far to 1 near.
export function desert(n, dots, frame) {
  const out = new Float32Array(n * 4);
  const count = dots.length / 4;
  for (let i = 0; i < n; i++) {
    if (i >= count) { write(out, i, rand(frame.w / 2, -frame.w / 2) + frame.x, rand(frame.h / 2, -frame.h / 2), 0, LANDSCAPE, rand(0.12, 0.03)); continue; }
    const u = dots[i * 4] / 65535 - 0.5;
    const v = 0.5 - dots[i * 4 + 1] / 65535;
    const luma = dots[i * 4 + 3];
    write(out, i, u * frame.w + frame.x, v * frame.h, dots[i * 4 + 2] / 65535, luma & 1 ? FIGURE : LANDSCAPE, 0.1 + (luma / 65535) * 0.9);
  }
  return out;
}

// The dust parts: dots crowd the edges of one or more narrow openings and leave them dark. Not a door,
// just the place where the dark gives way. gaps: where each opening stands, in scene units across.
export function seam(n, aspect, gaps) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const at = gaps[i % gaps.length];
    if (i % 5 === 4) { write(out, i, rand(aspect * 1.4, -aspect * 1.4), rand(1.4, -1.4), rand(0, -1.2), FIELD, rand(0.14, 0.03)); continue; }
    const y = rand(1.25, -1.25);
    const open = 0.012 + 0.07 * Math.max(0, Math.cos((y / 1.25) * (Math.PI / 2))) ** 1.4; // widest in the middle, closing to a line
    const side = i % 2 ? 1 : -1;
    const away = -Math.log(1 - Math.random() * 0.995) * 0.13;
    write(out, i, at + side * (open + away), y, 0, STILL, Math.max(0.08, 0.95 - away * 3.4));
  }
  return out;
}

// One shape per stage, each keeping every word before it where it was: the dots of an earlier word
// never move, so what's learned stays on. The last share of the dots stays as stars.
export function keptWords(n, words, aspect, narrow) {
  const width = narrow ? 900 : 1400;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width / aspect);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  const size = narrow ? canvas.width * 0.112 : canvas.height * 0.098;
  ctx.font = `700 ${size}px 'Space Grotesk', system-ui, sans-serif`;
  // Across the free part of the screen, not in a list: they sit where they fall and lean on each other.
  const places = narrow
    ? [[0.34, 0.21], [0.6, 0.26], [0.3, 0.31], [0.62, 0.36], [0.32, 0.41], [0.6, 0.46], [0.3, 0.51]]
    : [[0.58, 0.2], [0.76, 0.3], [0.57, 0.4], [0.75, 0.5], [0.58, 0.6], [0.76, 0.7], [0.6, 0.8]];
  const pixels = words.map((word, w) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(word, places[w][0] * canvas.width, places[w][1] * canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const filled = [];
    for (let i = 3, at = 0; i < data.length; i += 4, at++) if (data[i] > 128) filled.push(at);
    return filled;
  });
  const bucket = words.length + 1;
  const stars = new Float32Array(n * 4);
  const placed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    write(stars, i, rand(aspect * 1.4, -aspect * 1.4), rand(1.4, -1.4), rand(0.8, -1.4), FIELD, Math.random() ** 3 * 0.5 + 0.05);
    const filled = pixels[i % bucket];
    if (!filled) continue;
    const at = filled[Math.floor(Math.random() * filled.length)];
    write(placed, i, (((at % canvas.width) + Math.random()) / canvas.width * 2 - 1) * aspect, 1 - ((Math.floor(at / canvas.width) + Math.random()) / canvas.height) * 2, 0, STILL, rand(1, 0.45));
  }
  return words.map((_, stage) => {
    const shape = stars.slice();
    for (let i = 0; i < n; i++) {
      if (i % bucket > stage) continue;
      for (let c = 0; c < 4; c++) shape[i * 4 + c] = placed[i * 4 + c];
    }
    return shape;
  });
}

// Words drawn into a canvas, then read back as tightly packed dots.
export function words(n, lines, aspect, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = Math.round(1600 / aspect);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const size = Math.min((canvas.width * 0.86) / Math.max(...lines.map((line) => line.length * 0.5)), canvas.height * 1.5) * scale;
  ctx.font = `700 ${size}px 'Space Grotesk', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height * 0.46 + (i - (lines.length - 1) / 2) * size * 1.02));
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const filled = [];
  for (let i = 3, at = 0; i < data.length; i += 4, at++) if (data[i] > 128) filled.push(at);

  const out = new Float32Array(n * 4);
  const lit = Math.floor(n * 0.7); // the rest stay stars, so the sky doesn't empty
  for (let i = 0; i < n; i++) {
    if (i >= lit || !filled.length) { write(out, i, rand(aspect * 1.4, -aspect * 1.4), rand(1.2, -1.2), rand(0, -1.2), FIELD, rand(0.14, 0.03)); continue; }
    const at = filled[Math.floor(Math.random() * filled.length)];
    const x = ((at % canvas.width) + Math.random()) / canvas.width;
    const y = (Math.floor(at / canvas.width) + Math.random()) / canvas.height;
    write(out, i, (x * 2 - 1) * aspect, 1 - y * 2, 0, STILL, rand(1, 0.5));
  }
  return out;
}

const onLand = (land, lat, lon) => {
  const x = Math.min(LAND_W - 1, Math.floor(((lon + 180) / 360) * LAND_W));
  const y = Math.min(LAND_H - 1, Math.floor(((90 - lat) / 180) * LAND_H));
  const bit = y * LAND_W + x;
  return (land[bit >> 3] & (0x80 >> (bit & 7))) !== 0;
};

const onSphere = (lat, lon, r = GLOBE_RADIUS) => {
  const a = (lat * Math.PI) / 180;
  const b = (lon * Math.PI) / 180;
  return [r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b)];
};

// Continents in dots; India, the UK, Australia and the USA in orange, joined by arcs.
export function globe(n, land) {
  const out = new Float32Array(n * 4);
  const cities = [DELHI, MUMBAI, LONDON, EDINBURGH, SYDNEY, MELBOURNE, NEW_YORK, SAN_FRANCISCO];
  const arcs = [[DELHI, LONDON], [MUMBAI, EDINBURGH], [DELHI, SYDNEY], [MUMBAI, MELBOURNE], [LONDON, NEW_YORK], [EDINBURGH, SAN_FRANCISCO]];
  const hot = Math.floor(n * 0.08);
  for (let i = 0; i < n - hot; i++) {
    let lat;
    let lon;
    let found = false;
    for (let tries = 0; tries < 40 && !found; tries++) {
      lat = (Math.asin(rand(1, -1)) * 180) / Math.PI;
      lon = rand(180, -180);
      found = onLand(land, lat, lon);
    }
    const isOcean = !found || i % 7 === 0;
    if (isOcean) { lat = (Math.asin(rand(1, -1)) * 180) / Math.PI; lon = rand(180, -180); }
    const [x, y, z] = onSphere(lat, lon);
    write(out, i, x, y, z, GLOBE, isOcean ? 0.14 : rand(1, 0.6));
  }
  for (let i = n - hot; i < n; i++) {
    if (i % 3 === 0) {
      const c = cities[i % cities.length];
      const [x, y, z] = onSphere(c[0] + rand(1.6, -1.6), c[1] + rand(1.6, -1.6), GLOBE_RADIUS * 1.01);
      write(out, i, x, y, z, HOT, 1);
    } else {
      const [from, to] = arcs[i % arcs.length];
      const t = Math.random();
      const lift = 1 + Math.sin(t * Math.PI) * 0.16;
      const [x, y, z] = onSphere(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, GLOBE_RADIUS * lift);
      write(out, i, x, y, z, HOT, 0.75);
    }
  }
  return out;
}

// Radio static: restless noise across the whole screen. The dial hasn't found anything yet.
export function radioStatic(n, aspect) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    write(out, i, rand(aspect, -aspect), rand(1, -1), rand(0.3, -0.3), STATIC, rand(0.5, 0.08));
  }
  return out;
}

// The voice through the static: every particle on one clean orange wave.
export function signal(n, aspect) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    write(out, i, rand(aspect * 1.1, -aspect * 1.1), (Math.random() - 0.5) * 0.012, 0, SIGNAL, rand(0.9, 0.3));
  }
  return out;
}

export function field(n, aspect) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    write(out, i, rand(aspect * 1.4, -aspect * 1.4), rand(1.4, -1.4), rand(0.8, -1.4), FIELD, Math.random() ** 3 * 0.8 + 0.06);
  }
  return out;
}

// Stars spread around the path of the camera; the shader carries them past it.
export function tunnel(n, aspect) {
  const out = new Float32Array(n * 4);
  const spread = Math.max(aspect, 1) * 2.2;
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2);
    const r = 0.25 + Math.random() ** 0.6 * spread;
    write(out, i, Math.cos(a) * r, Math.sin(a) * r * 0.7, rand(5.4), TUNNEL, Math.random() ** 2 * 0.7 + 0.08);
  }
  return out;
}
