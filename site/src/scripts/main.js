import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import { createScore } from './score.js';
import { startCursor } from './cursor.js';
import { playLoader } from './loader.js';
import { isCalm } from './calm.js';
import { quietBehindText } from './quiet.js';
import { createClose } from './close.js';

// The conductor: one loop reads the scroll position and drives the figure, the particle morphs
// and the walk into the light. The HTML is
// already the finished page, so reduced motion just never starts any of it.
const PARTICLES = innerWidth < 640 ? 26000 : 58000; // a phone builds every shape on a slower CPU, so it gets fewer dots
const GLOBE_SHIFT = 0.2; // of the screen's half-width, so the globe sits clear of its sentence; .orbit in base.css moves with it
const FORM_SECONDS = 2.8;
const LEAN = [0.07, 0.035]; // radians the figure leans toward the light, sideways and up: about 4 and 2 degrees
const HERO_TURN_SCROLL = 1.05; // screens of scroll it takes me to turn from facing you to the three-quarter slant, toward the words
const HERO_ASIDE_SCROLL = 0.45;
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 60));

const score = createScore();
let formStart = null; // when the portrait starts to form, which is when the loader hands over
let markReady;
const sceneReady = new Promise((resolve) => { markReady = resolve; });
const gated = root.classList.contains('loading');
playLoader(sceneReady, (withSound) => score.enter(withSound)).then(() => { formStart = performance.now(); });

/* ---------- Motion ---------- */

function splitWords(el) {
  const text = el.textContent;
  el.textContent = '';
  const words = text.trim().split(/\s+/).map((word) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = word;
    el.append(span, ' ');
    return span;
  });
  return { el, text, words };
}

async function startMotion() {
  const scene = createScene(PARTICLES);
  if (!scene) { root.classList.add('no-scene'); markReady(); return; }

  let figure;
  let land;
  try {
    const [p, l] = await Promise.all(['/hero/views.bin', '/hero/land.bin'].map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.arrayBuffer();
    }));
    figure = shapes.readViews(p);
    land = new Uint8Array(l);
  } catch (err) {
    console.warn('Particle data unavailable; showing the static page.', err);
    scene.stop();
    root.classList.add('no-scene');
    markReady();
    return;
  }

  const sections = [...document.querySelectorAll('[data-shape]')];
  const portraitEl = document.querySelector('[data-portrait]');
  const spots = [...document.querySelectorAll('[data-spot]')].map((el) => ({ el, x: 0, y: 0, o: 0 }));
  const lenis = new Lenis({ lerp: 0.09, anchors: true });
  const close = createClose(scene, lenis, PARTICLES);

  document.body.prepend(scene.canvas);
  const quiet = quietBehindText(scene.canvas);
  root.classList.add('scene-on');
  await new Promise(requestAnimationFrame); // let the pinned heights apply before measuring

  const toUnits = (px, py) => {
    const aspect = innerWidth / innerHeight;
    return [((px / innerWidth) * 2 - 1) * aspect, 1 - (py / innerHeight) * 2];
  };

  let tops = [];
  let heroPan = [0, 0];
  let heroEnd = { x: 0, y: 0, zoom: 1 };
  let layoutRun = 0;

  const layout = () => {
    const aspect = innerWidth / innerHeight;
    const wide = innerWidth >= 900;
    scene.resize();

    // Measured with the page at rest, so scroll offsets are stable.
    const y = scrollY;
    tops = sections.map((s) => s.getBoundingClientRect().top + y);
    close.layout();

    const fig = portraitEl.getBoundingClientRect();
    const [bx, by] = toUnits(fig.left, fig.top + y);
    const bw = (fig.width / innerWidth) * 2 * aspect;
    const bh = (fig.height / innerHeight) * 2;
    heroPan = [bx + bw / 2, by - shapes.HEAD_PIVOT * bh];
    heroEnd = wide ? { x: aspect * 0.56, y: heroPan[1] - 0.04, zoom: 0.98 } : { x: aspect * 0.42, y: heroPan[1] - 1.18, zoom: 0.62 }; // clear of the statement: right on a wide screen, below it on a phone
    scene.setShape('cloud', shapes.cloud(PARTICLES));
    scene.setShape('portrait', shapes.portrait(PARTICLES, figure, 0, { w: bw, h: bh }));


    // The rest are built one per idle moment, so loading never blocks the page.
    const pending = [
      () => scene.setShape('slant', shapes.portrait(PARTICLES, figure, 1, { w: bw, h: bh })), // only seen once you scroll, so built when the page is idle
      () => scene.setShape('globe', shapes.globe(PARTICLES, land)),
      () => scene.setShape('field', shapes.field(PARTICLES, aspect)), // quiet dust where the words are the point
      close.build, // only once its dots have arrived; they are fetched as the close comes near
    ];
    const run = ++layoutRun;
    const next = () => {
      if (run !== layoutRun || !pending.length) return;
      pending.shift()();
      whenIdle(next);
    };
    whenIdle(next);
  };
  layout();
  requestAnimationFrame(() => close.toContact(location.hash));



  let lastWidth = innerWidth;
  let timer = 0;
  const onResize = () => {
    if (innerWidth === lastWidth && Math.abs(innerHeight - scene.canvas.clientHeight) < 140) return;
    lastWidth = innerWidth;
    clearTimeout(timer);
    timer = setTimeout(layout, 180);
  };
  addEventListener('resize', onResize, { passive: true });

  const reveals = [...document.querySelectorAll('[data-words]')].map(splitWords);
  const cursor = startCursor();
  const lean = [0, 0];


  let bass = 0;
  let shrill = 0;
  const t0 = performance.now();
  let raf = 0;
  markReady();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    lenis.raf(now);
    quiet();
    const time = (now - t0) / 1000;
    const y = scrollY;
    const vw = innerWidth;
    const vh = innerHeight;
    const aspect = vw / vh;

    // The pointer is the light. With no pointer, as on a phone, it wanders slowly over the figure.
    root.classList.toggle('scrolled', y > 40);
    cursor.tick();
    const light = cursor.on ? toUnits(cursor.x, cursor.y) : [Math.sin(time * 0.31) * 0.4, 0.2 + Math.cos(time * 0.23) * 0.4];
    lean[0] += ((light[0] / aspect) * LEAN[0] - lean[0]) * 0.09;
    lean[1] += (-light[1] * LEAN[1] - lean[1]) * 0.09;

    // Which two shapes are in play, and how far between them.
    let from = 0;
    let to = 0;
    let morph = 1;
    for (let i = 1; i < sections.length; i++) {
      const begin = tops[i] - vh;
      if (y < begin) break;
      from = i - 1;
      to = i;
      morph = clamp((y - begin) / vh);
      if (morph >= 1) { from = i; morph = 1; }
    }
    let fromName = sections[from].dataset.shape;
    let toName = sections[to].dataset.shape;
    if (from === to || fromName === toName) { toName = fromName; morph = 1; } // the figure doesn't morph, it turns
    const formed = formStart === null ? 0 : (now - formStart) / 1000 / FORM_SECONDS;
    if (formed < 1 && y < 10) {
      // The cloud gathers into the portrait once the visitor has chosen how to enter.
      fromName = 'cloud';
      toName = 'portrait';
      morph = 1 - (1 - clamp(formed)) ** 3;
    }
    // I turn by flowing from the front view into the three-quarter slant, toward the words; once turned, I stay turned.
    const turning = ease(clamp(y / (vh * HERO_TURN_SCROLL)));
    if (y >= 10) {
      if (fromName === 'portrait' && toName === 'portrait') { toName = 'slant'; morph = turning; }
      else {
        if (fromName === 'portrait') fromName = 'slant';
        if (toName === 'portrait') toName = 'slant';
      }
    }
    if (!scene.has(toName)) toName = fromName;
    if (!scene.has(fromName)) { fromName = 'cloud'; toName = 'cloud'; }

    const levels = score.levels();
    bass += (levels.low - bass) * 0.12;
    shrill += (levels.high - shrill) * 0.12;

    // The figure: at the hero it faces you; scrolling turns it and walks it to the right.
    // I step aside faster than I turn, so the statement's words arrive on empty dark and never on me.
    const aside = ease(clamp(y / (vh * HERO_ASIDE_SCROLL)));
    const pan = [lerp(heroPan[0], heroEnd.x, aside), lerp(heroPan[1], heroEnd.y, aside)];
    const zoom = lerp(1, heroEnd.zoom, aside);





    const { walk, focus, ground } = close.tick(now, y, cursor);

    // Words stay dim until the light finds them. With no pointer, the scroll carries the light across.
    spots.forEach((spot) => {
      const rect = spot.el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      const near = cursor.on && cursor.x > rect.left - 140 && cursor.x < rect.right + 140 && cursor.y > rect.top - 140 && cursor.y < rect.bottom + 140;
      const tx = cursor.on ? cursor.x - rect.left : rect.width * clamp((vh * 0.9 - rect.top) / (vh * 0.75));
      const ty = cursor.on ? cursor.y - rect.top : rect.height / 2;
      spot.x += (tx - spot.x) * 0.1;
      spot.y += (ty - spot.y) * 0.1;
      spot.o += ((near || !cursor.on ? 1 : 0) - spot.o) * 0.08;
      spot.el.style.setProperty('--x', `${spot.x.toFixed(1)}px`);
      spot.el.style.setProperty('--y', `${spot.y.toFixed(1)}px`);
      spot.el.style.setProperty('--o', spot.o.toFixed(3));
    });


    reveals.forEach((r) => {
      const box = r.el.getBoundingClientRect();
      if (box.bottom < -40 || box.top > vh + 40) return;
      const p = clamp((vh * 0.92 - box.top) / (vh * 0.28)); // done by mid-screen, so pinned text finishes
      r.words.forEach((w, i) => {
        const o = clamp(p * (r.words.length + 5) - i, 0, 1);
        w.style.opacity = 0.08 + o * 0.92;
        w.style.filter = o < 1 ? `blur(${(1 - o) * 6}px)` : '';
      });
    });

    scene.draw({
      from: fromName,
      to: toName,
      morph,
      time,
      mouse: light,
      lean,
      level: Math.min(1, bass * 1.1),
      high: Math.min(1, shrill * 2),
      pan,
      zoom,
      globeX: innerWidth >= 900 ? aspect * GLOBE_SHIFT : 0,
      walk,
      focus,
      ground,
    });
  };
  raf = requestAnimationFrame(frame);
}

score.init(document.querySelector('[data-sound-toggle]'), isCalm, gated);

// Content and the model poster remain visible if enhancement fails or WebGL is unavailable.
document.fonts.ready.then(() => {
  if (isCalm()) { markReady(); return; }
  startMotion().catch((err) => {
    console.warn('Motion unavailable; showing the complete static site.', err);
    root.classList.remove('scene-on');
    root.classList.add('no-scene');
    markReady();
  });
});
