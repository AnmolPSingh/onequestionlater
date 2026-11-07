import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import * as journey from './journey-shapes.js';
import { isCalm } from './calm.js';
import { startCursor } from './cursor.js';

// The philosophy as a journey. The page pins, and the scroll is the playhead: each beat reshapes the one
// particle cloud into its own formation while its words arrive beside it, lists unfolding line by line.
// The HTML is already the finished page, so reduced motion simply never starts any of this.
const PARTICLES = innerWidth < 640 ? 24000 : 40000;
const STEP = 0.8; // screens of scroll per beat; matches .journey's height in philosophy.css
const MORPH = 0.45; // share of a beat the cloud takes to become its new formation
const WORDS_IN = [0.12, 0.34]; // share of a beat over which its words arrive
const WORDS_OUT = [0.82, 1]; // and leave, while the next formation gathers
const UNFOLD = [0.18, 0.62]; // a beat's list arrives line by line across this share
const SHIFT = 0.42; // of the screen's half-width: formations sit right of the words on a wide screen
const LEAVE_MS = 650;
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (v, a, b) => clamp((v - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);

try { sessionStorage.setItem('loaded', '1'); } catch { /* private mode: the home page's loader just plays */ }

async function start() {
  const scene = createScene(PARTICLES);
  if (!scene) return;
  const lenis = new Lenis({ lerp: 0.09 });
  document.body.prepend(scene.canvas);
  root.classList.add('scene-on', 'journey-on');
  await new Promise(requestAnimationFrame);

  const track = document.querySelector('[data-journey]');
  const counter = document.querySelector('[data-count-out]');
  const beats = [...track.querySelectorAll('.beat')].map((el) => ({
    el,
    shape: el.dataset.shape,
    count: el.dataset.count,
    lines: [...el.querySelectorAll('[data-unfold] li')],
  }));
  let top = 0;
  let wide = true;

  const layout = () => {
    const aspect = innerWidth / innerHeight;
    wide = innerWidth >= 900;
    scene.resize();
    top = track.getBoundingClientRect().top + scrollY;
    const place = wide ? { scale: 0.62, lift: 0 } : { scale: 0.5, lift: 0.4 };
    for (const name of ['galaxy', 'found', 'path', 'lessons', 'accumulated', 'constant', 'loop']) scene.setShape(name, journey[name](PARTICLES, place));
    scene.setShape('static', shapes.radioStatic(PARTICLES, aspect));
    const wave = shapes.signal(PARTICLES, aspect);
    for (let k = 1; k < wave.length; k += 4) wave[k] += wide ? -0.55 : 0.45; // below the words on a wide screen, above them on a phone
    scene.setShape('signal', wave);
    scene.setShape('tunnel', shapes.tunnel(PARTICLES, aspect));
    const mark = shapes.words(PARTICLES, ['?'], aspect, wide ? 0.62 : 0.4);
    for (let k = 0; k < mark.length; k += 4) {
      if (wide) mark[k] += aspect * SHIFT;
      else mark[k + 1] += 0.42;
    }
    scene.setShape('mark', mark);
  };
  layout();

  let lastWidth = innerWidth;
  let timer = 0;
  addEventListener('resize', () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    clearTimeout(timer);
    timer = setTimeout(layout, 180);
  }, { passive: true });

  // Reaching the arrow carries on rather than stops: the stars rush ahead and you follow them in.
  let leaving = false;
  document.querySelector('.beat-on').addEventListener('click', (e) => {
    e.preventDefault();
    const { href } = e.currentTarget;
    leaving = true;
    setTimeout(() => { location.href = href; }, LEAVE_MS);
  });

  const cursor = startCursor();
  const t0 = performance.now();
  let rush = 0;
  let shown = -1;

  const frame = (now) => {
    requestAnimationFrame(frame);
    lenis.raf(now);
    const time = (now - t0) / 1000;
    const vh = innerHeight;
    const aspect = innerWidth / vh;
    cursor.tick();
    const mouse = cursor.on ? [((cursor.x / innerWidth) * 2 - 1) * aspect, 1 - (cursor.y / vh) * 2] : [Math.sin(time * 0.31) * 0.6, Math.cos(time * 0.23) * 0.5];

    // Where the playhead is: which beat, and how far into it.
    const p = clamp((scrollY - top) / (vh * STEP), 0, beats.length - 0.0001);
    const at = Math.floor(p);
    const last = beats.length - 1;

    beats.forEach((beat, j) => {
      const u = p - j;
      const o = ease(ramp(u, WORDS_IN[0], WORDS_IN[1])) * (j === last ? 1 : 1 - ease(ramp(u, WORDS_OUT[0], WORDS_OUT[1])));
      if (j === 0) beat.o = p < WORDS_OUT[0] ? 1 : o; // the first words are already there when you arrive
      else beat.o = o;
      beat.el.style.opacity = beat.o.toFixed(3);
      beat.el.style.filter = beat.o < 1 ? `blur(${((1 - beat.o) * 6).toFixed(1)}px)` : '';
      beat.el.classList.toggle('on', beat.o > 0.02);
      if (beat.lines.length) {
        const k = ramp(u, UNFOLD[0], UNFOLD[1]) * (beat.lines.length + 1);
        beat.lines.forEach((li, i) => { li.style.opacity = clamp(k - i).toFixed(3); });
      }
    });
    if (at !== shown) { shown = at; counter.textContent = beats[at].count; }

    // The cloud: as each beat begins, it leaves the last formation and becomes this one.
    const from = beats[Math.max(0, at - 1)].shape;
    const to = beats[at].shape;
    const morph = at === 0 || from === to ? 1 : ease(clamp((p - at) / MORPH));

    rush += leaving ? 0.14 : 0;
    scene.draw({ from, to, morph, time, mouse, fly: p * 1.6 + time * 0.04 + rush, globeX: wide ? aspect * SHIFT : 0 });
  };
  requestAnimationFrame(frame);
}

document.fonts.ready.then(() => { if (!isCalm()) start(); });
