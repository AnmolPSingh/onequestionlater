import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import { isCalm } from './calm.js';
import { startCursor } from './cursor.js';
import { quietBehindText } from './quiet.js';

// The philosophy page: one particle field behind nine chapters. Each chapter names its shape in the markup;
// the field reforms into it as the chapter arrives, and the chapter's lines come in once and stay. The HTML
// is already the finished page, so reduced motion never starts any of this.
const PARTICLES = innerWidth < 640 ? 24000 : 38000;
const MORPH_SCREENS = 0.6; // how long one shape takes to become the next
const LEAVE_MS = 650;
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

try { sessionStorage.setItem('loaded', '1'); } catch { /* private mode: the home page's loader just plays */ }

function revealChapters() {
  root.classList.add('reveal-on');
  const seen = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    seen.unobserve(entry.target);
  }), { threshold: 0.25 });
  document.querySelectorAll('.ch').forEach((ch) => seen.observe(ch));
}

async function start() {
  revealChapters();
  const scene = createScene(PARTICLES);
  if (!scene) return;
  const lenis = new Lenis({ lerp: 0.09 });
  document.body.prepend(scene.canvas);
  const quiet = quietBehindText(scene.canvas);
  root.classList.add('scene-on');
  await new Promise(requestAnimationFrame);

  const chapters = [...document.querySelectorAll('.ch')].map((el) => ({ el, shape: el.dataset.shape, top: 0 }));
  const layout = () => {
    const aspect = innerWidth / innerHeight;
    scene.resize();
    chapters.forEach((c) => { c.top = c.el.getBoundingClientRect().top + scrollY; });
    scene.setShape('field', shapes.field(PARTICLES, aspect));
    scene.setShape('tunnel', shapes.tunnel(PARTICLES, aspect));
    scene.setShape('seam', shapes.seam(PARTICLES, aspect, [0]));
    scene.setShape('seams', shapes.seam(PARTICLES, aspect, innerWidth < 900 ? [-0.34, 0.34] : [-0.9, -0.1, 0.72]));
    const mark = shapes.words(PARTICLES, ['?'], aspect, 0.42);
    if (innerWidth >= 900) for (let k = 0; k < mark.length; k += 4) mark[k] += aspect * 0.78; // out at the right edge, clear of the words
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

  // Reaching the arrow carries on rather than stops: the dots rush ahead and you follow them in.
  let leaving = false;
  document.querySelector('.ch-on').addEventListener('click', (e) => {
    e.preventDefault();
    const { href } = e.currentTarget;
    leaving = true;
    setTimeout(() => { location.href = href; }, LEAVE_MS);
  });

  const cursor = startCursor();
  const t0 = performance.now();
  let fly = 0;

  const frame = (now) => {
    requestAnimationFrame(frame);
    lenis.raf(now);
    quiet();
    const time = (now - t0) / 1000;
    const y = scrollY;
    const vh = innerHeight;
    const aspect = innerWidth / vh;
    cursor.tick();
    const mouse = cursor.on ? [((cursor.x / innerWidth) * 2 - 1) * aspect, 1 - (cursor.y / vh) * 2] : [Math.sin(time * 0.31) * 0.6, Math.cos(time * 0.23) * 0.5];

    // The shape of the chapter now filling the screen, reforming from the one before as it arrives.
    let i = chapters.length - 1;
    while (i > 0 && chapters[i].top - vh * 0.5 > y) i--;
    const from = chapters[Math.max(0, i - 1)].shape;
    const to = chapters[i].shape;
    const morph = i === 0 || from === to ? 1 : clamp((y - (chapters[i].top - vh * 0.5)) / (vh * MORPH_SCREENS));

    fly += leaving ? 0.14 : 0.002;
    scene.draw({ from, to, morph, time, mouse, fly: y / vh + fly });
  };
  requestAnimationFrame(frame);
}

document.fonts.ready.then(() => { if (!isCalm()) start(); });
