import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import { isCalm } from './calm.js';
import { startCursor } from './cursor.js';
import { fitThreads } from './thread.js';

// The philosophy page: each section is pinned and its scroll runs from 0 to 1. Lines say when they
// arrive and leave in the markup; particle shapes are listed the same way. The HTML is already the
// finished page, so reduced motion just never starts any of this.
const PARTICLES = innerWidth < 640 ? 24000 : 38000;
const MORPH_SCREENS = 0.5; // how long one shape takes to become the next
const LEAVE_MS = 650;
const BUILD_GAP = 60; // ms between building one shape and the next
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (v, a, b) => clamp((v - a) / (b - a));

try { sessionStorage.setItem('loaded', '1'); } catch { /* private mode: the home page's loader just plays */ }

// Each line's reveal, read once from the markup.
function readLines(section) {
  return [...section.querySelectorAll('[data-in]')].map((el) => ({
    el,
    at: parseFloat(el.dataset.in),
    span: parseFloat(el.dataset.span || 0.05),
    out: el.dataset.out === undefined ? null : parseFloat(el.dataset.out),
    next: el.dataset.next === undefined ? null : parseFloat(el.dataset.next),
  }));
}

// How far along the drawn path each node sits, so the thread reaches a word as that word lands.
function measureThread(path, points) {
  const total = path.getTotalLength();
  const stops = [];
  let from = 0;
  const steps = 260;
  for (const point of points) {
    let best = from;
    let bestD = Infinity;
    for (let s = from; s <= steps; s++) {
      const p = path.getPointAtLength((s / steps) * total);
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < bestD) { bestD = d; best = s; }
      if (d > bestD + 180) break;
    }
    stops.push(best / steps);
    from = best;
  }
  return stops;
}

function followAlong(stops, ats, p) {
  if (p <= ats[0]) return (p / ats[0]) * stops[0];
  for (let i = 1; i < ats.length; i++) {
    if (p <= ats[i]) return stops[i - 1] + (stops[i] - stops[i - 1]) * ((p - ats[i - 1]) / (ats[i] - ats[i - 1]));
  }
  return stops[stops.length - 1] + (1 - stops[stops.length - 1]) * ramp(p, ats[ats.length - 1], 1);
}

async function start() {
  const scene = createScene(PARTICLES);
  if (!scene) return;
  const lenis = new Lenis({ lerp: 0.09 });
  document.body.prepend(scene.canvas);
  root.classList.add('scene-on');
  await new Promise(requestAnimationFrame);

  const sections = [...document.querySelectorAll('[data-ph]')].map((el) => ({ el, lines: readLines(el), top: 0, range: 1 }));
  const wheel = sections.find((s) => s.el.dataset.wheel !== undefined);
  const spokes = wheel ? [...wheel.el.querySelectorAll('[data-spoke]')] : [];
  const keep = sections.find((s) => s.el.dataset.keywords);
  const keywords = keep.el.dataset.keywords.split('|');
  const follow = sections.find((s) => s.el.classList.contains('ph-follow'));
  const breakup = document.querySelector('[data-break]');
  const realisation = sections.find((s) => s.el.classList.contains('ph-real'));
  const sum = sections.find((s) => s.el.classList.contains('ph-sum'));
  const joins = [...sum.el.querySelectorAll('[data-chord-at]')];
  let threads = [];
  let chords = [];
  let keys = [];
  let run = 0;

  const layout = () => {
    const vh = innerHeight;
    const aspect = innerWidth / vh;
    const narrow = innerWidth < 900;
    scene.resize();
    sections.forEach((s) => {
      s.top = s.el.getBoundingClientRect().top + scrollY;
      s.range = Math.max(1, s.el.offsetHeight - vh);
    });

    keys = [];
    sections.forEach((s) => {
      (s.el.dataset.shapes || '').split(',').filter(Boolean).forEach((entry) => {
        const [name, at] = entry.split('@');
        keys.push({ name, y: s.top + parseFloat(at) * s.range });
      });
    });

    fitThreads();
    const nodes = [...follow.el.querySelectorAll('[data-node]')];
    const ats = nodes.map((n) => parseFloat(n.dataset.in) + 0.03);
    const shown = narrow ? '.only-narrow' : '.only-wide';
    const place = narrow ? 'narrow' : 'wide';
    const stage = follow.el.querySelector('[data-stage-found]').getBoundingClientRect();
    const points = nodes.map((n) => {
      const style = getComputedStyle(n);
      return { x: (parseFloat(style.getPropertyValue(place === 'wide' ? '--x' : '--nx')) * stage.width) / 100, y: (parseFloat(style.getPropertyValue(place === 'wide' ? '--y' : '--ny')) * stage.height) / 100 };
    });
    threads = [];
    chords = [...sum.el.querySelectorAll(`.thread${shown} [data-chord]`)];

    scene.setShape('field', shapes.field(PARTICLES, aspect));
    scene.setShape('seam', shapes.seam(PARTICLES, aspect, [0]));
    // The rest wait for the first scroll, one per idle moment, so opening the page stays light.
    const build = [
      () => { threads = [...document.querySelectorAll(`.thread${shown} [data-thread]`)].slice(0, 1).map((path) => ({ path, stops: measureThread(path, points), ats })); },
      () => scene.setShape('seams', shapes.seam(PARTICLES, aspect, narrow ? [-0.34, 0.34] : [-0.9, -0.1, 0.72])),
      () => scene.setShape('tunnel', shapes.tunnel(PARTICLES, aspect)),
      () => scene.setShape('static', shapes.radioStatic(PARTICLES, aspect)),
      () => scene.setShape('signal', shapes.signal(PARTICLES, aspect)),
      () => scene.setShape('ribbon', shapes.ribbon(PARTICLES)),
      () => scene.setShape('mark', shapes.words(PARTICLES, ['?'], aspect, 0.56)),
      () => shapes.keptWords(PARTICLES, keywords, aspect, narrow).forEach((shape, i) => scene.setShape(`kept${i}`, shape)),
      () => {
        fetch('/hero/desert.bin')
          .then((res) => { if (!res.ok) throw new Error(`desert.bin returned ${res.status}`); return res.arrayBuffer(); })
          .then((buffer) => {
            const h = Math.max(2, (2 * aspect) / shapes.DESERT.ratio);
            const w = h * shapes.DESERT.ratio;
            const frame = { w, h, x: narrow ? (0.5 - shapes.DESERT.axis) * w : aspect * 0.42 }; // to the right, clear of the words
            scene.setShape('desert', shapes.desert(PARTICLES, new Uint16Array(buffer), frame));
            focus = [(shapes.DESERT.focus[0] - 0.5) * w + frame.x, (0.5 - shapes.DESERT.focus[1]) * h];
            feet = (0.5 - shapes.DESERT.feet) * h;
          })
          .catch((err) => console.warn('Desert unavailable on the philosophy page; the words carry it.', err));
      },
    ];
    const thisRun = ++run;
    const next = () => {
      if (thisRun !== run || !build.length) return;
      build.shift()();
      setTimeout(next, BUILD_GAP);
    };
    buildRest = next;
    if (scrolled) next();
  };
  let focus = [0, 0];
  let feet = 0;
  let scrolled = false;
  let buildRest = () => {};
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
  let leavingFrom = 0;
  document.querySelector('[data-onward]').addEventListener('click', (e) => {
    e.preventDefault();
    const { href } = e.currentTarget;
    root.classList.add('leaving');
    leavingFrom = performance.now();
    setTimeout(() => { location.href = href; }, LEAVE_MS);
  });

  const cursor = startCursor();
  const t0 = performance.now();
  let fly = 0;

  const frame = (now) => {
    requestAnimationFrame(frame);
    lenis.raf(now);
    const time = (now - t0) / 1000;
    const y = scrollY;
    const vh = innerHeight;
    const aspect = innerWidth / vh;
    if (!scrolled && y > 10) { scrolled = true; buildRest(); }
    cursor.tick();
    const mouse = cursor.on ? [((cursor.x / innerWidth) * 2 - 1) * aspect, 1 - (cursor.y / vh) * 2] : [Math.sin(time * 0.31) * 0.6, Math.cos(time * 0.23) * 0.5];

    sections.forEach((s) => {
      if (y < s.top - vh * 1.2 || y > s.top + s.range + vh * 1.2) return;
      const p = clamp((y - s.top) / s.range);
      s.p = p;
      s.lines.forEach((line) => {
        let t = ramp(p, line.at, line.at + line.span);
        if (line.out !== null) t *= 1 - ramp(p, line.out, line.out + line.span);
        line.el.style.setProperty('--t', t.toFixed(3));
        if (line.next !== null) line.el.style.setProperty('--dimmed', (1 - ramp(p, line.next, line.next + 0.05) * 0.5).toFixed(3));
      });
    });

    threads.forEach(({ path, stops, ats }) => { path.style.strokeDashoffset = (1 - followAlong(stops, ats, follow.p ?? 0)).toFixed(4); });
    if (realisation.p !== undefined) breakup.style.setProperty('--k', ramp(realisation.p, 0.12, 0.34).toFixed(3));
    chords.forEach((chord, i) => {
      const at = parseFloat(joins[i].dataset.in);
      chord.style.setProperty('--c', ramp(sum.p ?? 0, at, at + 0.06).toFixed(3));
    });
    if (wheel && wheel.p !== undefined) {
      const turn = wheel.p * (spokes.length - 1);
      spokes.forEach((spoke, i) => {
        spoke.style.setProperty('--turn', turn.toFixed(3));
        spoke.style.setProperty('--near', (1 - clamp(Math.abs(i - turn) * 1.5)).toFixed(3));
      });
    }

    // Which two shapes are in play.
    let i = keys.length - 1;
    while (i > 0 && keys[i].y > y) i--;
    let from = keys[Math.max(0, i - 1)].name;
    let to = keys[i].name;
    let morph = clamp((y - keys[i].y) / (vh * MORPH_SCREENS));
    if (i === 0) { from = to; morph = 1; }
    if (!scene.has(to)) to = scene.has(from) ? from : 'field';
    if (!scene.has(from)) from = to;
    if (from === to) morph = 1;

    fly += leavingFrom ? 0.14 : 0.002;
    scene.draw({ from, to, morph, time, mouse, fly: y / vh + fly, focus, feet });
  };
  requestAnimationFrame(frame);
}

document.fonts.ready.then(() => { if (!isCalm()) start(); });
