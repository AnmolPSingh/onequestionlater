import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import { createScore } from './score.js';
import { startCursor } from './cursor.js';
import { playLoader } from './loader.js';
import { isCalm } from './calm.js';
import { createBust, readBust, surfaceDot } from './bust.js';
import { createDunes } from './dunes.js';
import { startLivingDesert } from './living-desert.js';
import { fitThreads } from './thread.js';

// The conductor: one loop reads the scroll position and drives the figure, the particle morphs,
// the flight through the years, the project slides and the walk into the light. The HTML is
// already the finished page, so reduced motion just never starts any of it.
const PARTICLES = innerWidth < 640 ? 42000 : 58000;
const STRANDS = innerWidth < 640 ? 12000 : 30000;
const FORM_SECONDS = 2.8;
const PHOTO_HOLD = 0.7; // seconds the loader's last photo lies as dots before they leave for the portrait
const LEAN = [0.07, 0.035]; // radians the figure leans toward the light, sideways and up: about 4 and 2 degrees
const HERO_TURN = -0.48; // radians, so I end up looking toward the words. Daniel turns 0.6, but his face is wider in its head, so this reads the same
const IDLE_TURN = 0.05; // radians either way the head drifts at rest
const SURFACE_DOTS = 0.18; // restrained surface-attached points accompanying the living contours
const layer = new URLSearchParams(location.search).get('layer'); // ?layer=mesh or contours, to judge each alone
const HERO_TURN_SCROLL = 1.05; // screens of scroll the turn takes
const PAIR_GAP = 0.018; // of the screen's width, between two pictures that share a scene
const RUN_UP = 0.6; // stops of track before the first scene
const RUN_OUT = 0.2;
const FLY_TAIL = 1.4; // screens after the last scene: the stars gather into the words and hold
const REVEAL = 1; // screens of scroll the projects take to condense out of the particles, and to break back up
const GRAIN = { width: 720, height: 405, frames: 18 }; // one grain is about one particle on a laptop screen
const SLIDE_HOLD = 0.35; // of each slide's scroll, before the next starts to turn over
const WAVE_POINTS = 16;
const CLOSE_SCREENS = 3.2; // three deliberate screen-lengths: reveal, push through the landscape, then fade to white
// The desert remains recognizable through two sustained scroll lengths. A slow camera push-in
// starts after arrival; only the final portion fades to the white end card.
const CLOSE_PUSH = [0.12, 0.78];
const CLOSE_WHITE = [0.81, 0.995];
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 60));

const score = createScore();
let formStart = null; // when the portrait starts to form, which is when the loader hands over
let loaderPhoto = null; // the loader's last frame, until its dots are made
let markReady;
const sceneReady = new Promise((resolve) => { markReady = resolve; });
playLoader(sceneReady).then((photo) => { loaderPhoto = photo; formStart = performance.now(); });
const session = document.querySelector('[data-session]');
const clipLinks = new Map([...session.querySelectorAll('[data-clip]')].map((a) => [a.dataset.clip, a]));

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

// Each moment flies in from its own side: a spiral of angles, so no two neighbours come the same way.
function buildStops() {
  return [...session.querySelectorAll('.moment:not(.quiet)')].map((el, i) => ({
    el,
    id: el.dataset.moment,
    visual: el.querySelector('.moment-visual'),
    also: el.querySelector('.moment-visual.also'),
    text: el.querySelector('.moment-text'),
    dx: Math.cos(i * 2.4),
    dy: Math.sin(i * 2.4),
    side: el.dataset.side === 'right' ? 1 : -1,
    overlap: parseFloat(el.dataset.overlap) || 0,
    shift: 0,
    alsoShift: 0,
    on: false,
  }));
}

const ramp = (v, a, b) => clamp((v - a) / (b - a));

// Two pictures share the focus side by side, or with the second tucked behind the first.
function measurePair(stop) {
  const first = stop.visual.offsetWidth;
  const second = stop.also.offsetWidth;
  const gap = stop.overlap ? -stop.overlap * second : innerWidth * PAIR_GAP;
  stop.shift = (-stop.side * (second + gap)) / 2;
  stop.alsoShift = (stop.side * (first + gap)) / 2;
}

function place(visual, t, dx, dy, tiltX, tiltY, vw, vh, shift = 0) {
  // Far away it's small and off to one side; it hangs at the focus, then passes the camera and is gone.
  const push = Math.sign(t) * Math.abs(t) ** 1.6 * 2.2;
  const z = push < 0 ? push * 1500 : push * 620;
  const out = Math.abs(push) * (t < 0 ? 0.12 : 0.3);
  const here = 1 - clamp(Math.abs(t) * 2);
  visual.style.transform = `translate(calc(-50% + ${shift.toFixed(1)}px), -50%) perspective(1000px) translate3d(${(dx * out * vw).toFixed(1)}px, ${(dy * out * vh).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${(tiltX * (2 + here * 5) + t * 6).toFixed(2)}deg) rotateX(${(tiltY * (2 + here * 4)).toFixed(2)}deg)`;
}

// s runs 0 to 1 while the playhead is inside this scene's slot, and nothing of it shows outside that.
function flyStop(stop, s, index, count, vw, vh, tiltX, tiltY) {
  const on = s > -0.02 && s < 1.08;
  if (on !== stop.on) {
    stop.on = on;
    stop.el.classList.toggle('live', on);
    if (on && stop.also) measurePair(stop);
  }
  if (!on) return;
  // A pair arrives and leaves in opposite directions, each away from the other.
  place(stop.visual, s - 0.46, stop.also ? -stop.side : stop.dx, stop.also ? -0.2 : stop.dy, tiltX, tiltY, vw, vh, stop.shift);
  const fade = ramp(s, 0, 0.2) * (1 - ramp(s, 0.8, 1.06));
  stop.visual.style.opacity = fade;
  stop.visual.style.zIndex = count - index;
  if (stop.also) {
    place(stop.also, s - 0.46, stop.side, 0.45, tiltX, tiltY, vw, vh, stop.alsoShift);
    stop.also.style.opacity = fade;
    stop.also.style.zIndex = count - index - 1;
  }
  stop.text.style.opacity = ramp(s, 0, 0.08) * (1 - ramp(s, 0.9, 1));
  stop.text.style.transform = `translateY(${((s - 0.5) * 16).toFixed(1)}px)`;
}

// A strip of masks, each with more grains lit than the last, nearest the middle first. Generated
// here rather than downloaded, and used as a sprite so stepping through it costs almost nothing.
function makeGrain() {
  const { width, height, frames } = GRAIN;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height * frames;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const out = Math.hypot(x / width - 0.5, y / height - 0.5) / 0.71;
      const turn = (Math.random() * 0.7 + out * 0.3) * (frames - 1); // the frame this grain lights up in
      for (let f = Math.ceil(turn); f < frames; f++) image.data[((f * height + y) * width + x) * 4 + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null)); });
}

// The edge of the next slide: flat at rest, bowing upward in the middle as it comes over.
function waveClip(k) {
  const lift = k * (1 - k) * 110;
  const points = [];
  for (let i = 0; i <= WAVE_POINTS; i++) {
    const x = i / WAVE_POINTS;
    points.push(`${(x * 100).toFixed(2)}% ${Math.max(-5, (1 - k) * 100 - Math.sin(x * Math.PI) * lift).toFixed(2)}%`);
  }
  return `polygon(0% 105%, ${points.join(', ')}, 100% 105%)`;
}

async function startMotion() {
  const scene = createScene(PARTICLES);
  if (!scene) { root.classList.add('no-scene'); markReady(); return; }

  let bust;
  let land;
  try {
    const [mesh, strands, l] = await Promise.all(['/hero/bust.bin', '/hero/strands.bin', '/hero/land.bin'].map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.arrayBuffer();
    }));
    bust = readBust(mesh, strands, STRANDS);
    scene.setBust(createBust(scene.gl, bust, { mesh: layer !== 'contours', contours: layer !== 'mesh', strands: layer !== 'mesh' }));
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
  const closeEl = document.querySelector('[data-close]');
  const closeTitle = document.querySelector('[data-close-title]');
  const closeLead = document.querySelector('[data-close-lead]');
  const closeDetails = document.querySelector('[data-close-details]');
  const whiteLayer = document.querySelector('[data-white]');
  const ghost = document.querySelector('[data-ghost]');
  const livingCanvas = document.querySelector('[data-close-live]');
  let livingDesert = null;
  let desertAsked = false; // its images are only fetched as the close nears
  const head = session.querySelector('[data-head]');
  const pin = session.querySelector('[data-pin]');
  const nextLine = session.querySelector('[data-next-line]');
  const nextMark = session.querySelector('.session-next');
  const arrangement = session.querySelector('[data-arrangement]');
  const firstClip = session.querySelector('.clip');
  const stops = buildStops();
  const work = document.querySelector('[data-work]');
  const stage = document.querySelector('[data-stage]');
  const slides = [...document.querySelectorAll('[data-slide]')].map((el) => ({ el, body: el.querySelector('.slide-body') }));
  const ticks = [...document.querySelectorAll('[data-tick]')];
  const lens = document.querySelector('[data-lens]');
  const statement = document.querySelector('.statement');
  const pattern = document.querySelector('[data-pattern]');
  const spots = [...document.querySelectorAll('[data-spot]')].map((el) => ({ el, x: 0, y: 0, o: 0 }));
  const lenis = new Lenis({ lerp: 0.09, anchors: true });

  document.body.prepend(scene.canvas);
  root.classList.add('scene-on');
  await new Promise(requestAnimationFrame); // let the pinned heights apply before measuring

  const toUnits = (px, py) => {
    const aspect = innerWidth / innerHeight;
    return [((px / innerWidth) * 2 - 1) * aspect, 1 - (py / innerHeight) * 2];
  };

  let statementTop = 0;
  let tops = [];
  let sessionTop = 0;
  let sessionRange = 1;
  let slotWidth = 1;
  let nextTop = 0;
  let workTop = 0;
  let workRange = 1;
  let slideRange = 1;
  let grain = null;
  let grainAsked = false;
  let grainFrame = -1;
  let closeTop = 0;
  let heroPan = [0, 0];
  let bustScale = 1;
  let heroEnd = { x: 0, y: 0, zoom: 1 };
  let focus = [0, 0];
  let desertPoints = null;
  let dunes = null;
  let desertFeet = 0;
  let layoutRun = 0;

  const layout = () => {
    const aspect = innerWidth / innerHeight;
    const wide = innerWidth >= 900;
    scene.resize();

    // Measured with the page at rest, so scroll offsets are stable.
    const y = scrollY;
    tops = sections.map((s) => s.getBoundingClientRect().top + y);
    statementTop = statement.getBoundingClientRect().top + y;
    sessionTop = session.getBoundingClientRect().top + y;
    sessionRange = Math.max(1, session.offsetHeight - innerHeight * (1 + FLY_TAIL));
    nextTop = nextMark.getBoundingClientRect().top + y;
    slotWidth = firstClip.offsetWidth / (parseFloat(firstClip.style.getPropertyValue('--b')) - parseFloat(firstClip.style.getPropertyValue('--a')));
    workTop = work.getBoundingClientRect().top + y;
    workRange = Math.max(1, work.offsetHeight - innerHeight);
    slideRange = Math.max(1, workRange - innerHeight * REVEAL * 2);
    closeTop = closeEl.getBoundingClientRect().top + y;
    fitThreads();

    const fig = portraitEl.getBoundingClientRect();
    const [bx, by] = toUnits(fig.left, fig.top + y);
    const bw = (fig.width / innerWidth) * 2 * aspect;
    const bh = (fig.height / innerHeight) * 2;
    heroPan = [bx + bw / 2, by - shapes.HEAD_PIVOT * bh];
    heroEnd = wide ? { x: aspect * 0.46, y: heroPan[1] - 0.04, zoom: 1.14 } : { x: aspect * 0.34, y: heroPan[1] - 0.86, zoom: 0.72 };
    scene.setShape('cloud', shapes.cloud(PARTICLES));
    bustScale = bw / shapes.FRAME_WIDTH;
    const { shape, normals } = shapes.portrait(PARTICLES, (i) => surfaceDot(bust, i), bustScale);
    scene.setShape('portrait', shape);
    scene.setNormals(normals);

    // The landscape covers the screen. On a narrow one it slides over so I'm in the middle of it.
    const h = Math.max(2, (2 * aspect) / shapes.DESERT.ratio);
    const w = h * shapes.DESERT.ratio;
    const frame = { w, h, x: wide ? 0 : (0.5 - shapes.DESERT.axis) * w }; // the narrow screen slides over so I'm in the middle
    desertFeet = (0.5 - shapes.DESERT.feet) * h;
    focus = [(shapes.DESERT.focus[0] - 0.5) * w + frame.x, (0.5 - shapes.DESERT.focus[1]) * h];
    const pxPerUnit = innerHeight / 2;
    ghost.style.width = `${w * pxPerUnit}px`;
    ghost.style.height = `${h * pxPerUnit}px`;
    ghost.style.left = `${innerWidth / 2 + (frame.x - w / 2) * pxPerUnit}px`;
    ghost.style.top = `${innerHeight / 2 - (h / 2) * pxPerUnit}px`;
    const buildDesert = () => {
      if (desertPoints) scene.setShape('desert', shapes.desert(PARTICLES, desertPoints, frame));
      if (dunes) dunes.place(frame, shapes.DESERT.width);
    };

    // The rest are built one per idle moment, so loading never blocks the page.
    const pending = [
      () => scene.setShape('static', shapes.radioStatic(PARTICLES, aspect)),
      () => scene.setShape('signal', shapes.signal(PARTICLES, aspect)),
      () => scene.setShape('tunnel', shapes.tunnel(PARTICLES, aspect)),
      () => scene.setShape('next', shapes.words(PARTICLES, wide ? ['What comes next'] : ['What comes', 'next'], aspect)),
      () => scene.setShape('globe', shapes.globe(PARTICLES, land)),
      () => scene.setShape('ribbon', shapes.ribbon(PARTICLES)),
      () => {
        if (desertPoints) { buildDesert(); return; }
        Promise.all(['/hero/desert.bin', '/hero/desert-strands.bin'].map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${url} returned ${res.status}`);
          return res.arrayBuffer();
        }))
          .then(([dots, strands]) => {
            desertPoints = new Uint16Array(dots);
            dunes = createDunes(scene.gl, strands);
            scene.setDunes(dunes);
            buildDesert();
          })
          .catch((err) => console.warn('Desert scene unavailable; the page ends on the words.', err));
      },
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
  const flightStops = stops.length + RUN_UP + RUN_OUT;

  // Clips take you to their moment. Keyboard focus does too, so the tracks work without a mouse.
  const goToStop = (at) => lenis.scrollTo(sessionTop + ((at + 0.4 + RUN_UP) / flightStops) * sessionRange);
  const onClip = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Lenis's anchor handling would chase the moment's hidden list item
    goToStop(parseFloat(e.currentTarget.dataset.at));
  };
  const onClipFocus = (e) => { if (e.currentTarget.matches(':focus-visible')) goToStop(parseFloat(e.currentTarget.dataset.at)); };
  clipLinks.forEach((link) => { link.addEventListener('click', onClip); link.addEventListener('focus', onClipFocus); });

  // The lens follows the pointer over a slide and opens it; links on the slide stay links.
  const onStageMove = (e) => {
    lens.classList.toggle('on', !e.target.closest('a'));
    lens.style.left = `${e.clientX}px`;
    lens.style.top = `${e.clientY}px`;
  };
  const onStageLeave = () => lens.classList.remove('on');
  let slideNow = 0;
  const onStageClick = (e) => { if (!e.target.closest('a') && cursor.on) location.href = slides[slideNow].el.dataset.href; };
  // Tabbing to a link on a slide brings that slide up.
  const onStageFocus = (e) => {
    const at = slides.findIndex((slide) => slide.el.contains(e.target));
    if (at >= 0 && e.target.matches(':focus-visible')) lenis.scrollTo(workTop + innerHeight * REVEAL + (at / Math.max(1, slides.length - 1)) * slideRange, { immediate: true });
  };
  stage.addEventListener('pointermove', onStageMove);
  stage.addEventListener('pointerleave', onStageLeave);
  stage.addEventListener('click', onStageClick);
  stage.addEventListener('focusin', onStageFocus);

  let bass = 0;
  let shrill = 0;
  let current = null;
  let shownSlide = -1;
  const t0 = performance.now();
  let raf = 0;
  markReady();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    lenis.raf(now);
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
    if (loaderPhoto) {
      const { rect } = loaderPhoto;
      scene.setShape('photo', shapes.photo(PARTICLES, loaderPhoto, [toUnits(rect.left, rect.top), toUnits(rect.right, rect.bottom)]));
      loaderPhoto = null;
    }
    const formed = formStart === null ? 0 : (now - formStart) / 1000 / FORM_SECONDS;
    if (formed < 1 && y < 10) {
      // After the loader, the photo's own dots fly into the portrait; on a return visit it blows in.
      const fromPhoto = scene.has('photo');
      fromName = fromPhoto ? 'photo' : 'cloud';
      toName = 'portrait';
      const hold = PHOTO_HOLD / FORM_SECONDS;
      morph = fromPhoto ? ease(clamp((formed - hold) / (1 - hold))) : 1 - (1 - clamp(formed)) ** 3;
    }
    if (!scene.has(toName)) toName = fromName;
    if (!scene.has(fromName)) { fromName = 'cloud'; toName = 'cloud'; }

    // The sculpture gathers out of its own dots as they land, and breaks back into them as they leave.
    let body = 0;
    if (fromName === 'portrait') body = toName === 'portrait' ? 1 : 1 - ramp(morph, 0, 0.45);
    else if (toName === 'portrait') body = ease(ramp(formed, 0.55, 1));
    root.classList.toggle('on-sculpture', body > 0.5);

    const levels = score.levels();
    bass += (levels.low - bass) * 0.12;
    shrill += (levels.high - shrill) * 0.12;

    // The figure: at the hero it faces you; scrolling turns it and walks it to the right.
    const turning = ease(clamp(y / (vh * HERO_TURN_SCROLL)));
    const turn = HERO_TURN * turning + Math.sin(time * 0.21) * IDLE_TURN;
    const pan = [lerp(heroPan[0], heroEnd.x, turning), lerp(heroPan[1], heroEnd.y, turning)];
    const zoom = lerp(1, heroEnd.zoom, turning);

    // The steps climb on their own once the statement is in view, so they cost no scroll.
    pattern.classList.toggle('on', y > statementTop - vh * 0.35);

    // The flight through the years: scroll is the camera moving forward.
    const play = clamp((y - sessionTop) / sessionRange);
    const stopAt = -RUN_UP + play * flightStops;
    const flyEnd = sessionTop + sessionRange;
    const inSession = y > sessionTop - vh && y < sessionTop + session.offsetHeight;
    if (inSession) {
      const tiltX = cursor.on ? (cursor.x / vw - 0.5) * 2 : 0;
      const tiltY = cursor.on ? (0.5 - cursor.y / vh) * 2 : 0;
      stops.forEach((stop, i) => flyStop(stop, stopAt - i, i, stops.length, vw, vh, tiltX, tiltY));
      // The tracks and their shade arrive once the section has settled, and leave before it goes, so no edge ever crosses the particles.
      pin.style.setProperty('--veil', (ramp(y, sessionTop - vh * 0.1, sessionTop + vh * 0.35) * (1 - ramp(y, flyEnd - vh * 0.15, flyEnd + vh * 0.3))).toFixed(3));
      head.style.opacity = ramp(y, sessionTop - vh * 0.1, sessionTop + vh * 0.1) * (1 - ramp(stopAt, -0.3, -0.02));
      arrangement.scrollLeft = Math.max(0, stopAt) * slotWidth;
      const nearest = stops[clamp(Math.floor(stopAt), 0, stops.length - 1)];
      if (nearest !== current) {
        if (current) clipLinks.get(current.id)?.removeAttribute('aria-current');
        clipLinks.get(nearest.id)?.setAttribute('aria-current', 'true');
        current = nearest;
      }
      nextLine.style.opacity = ramp(y, nextTop - vh * 0.25, nextTop) * (1 - ramp(y, nextTop + vh * 0.2, nextTop + vh * 0.5));
    }

    // The projects condense out of the particles once the section has settled, turn over slide by
    // slide, then break back up. The stage never moves, so no edge ever crosses the scene.
    const box = work.getBoundingClientRect();
    if (!grainAsked && box.top < vh * 3) { // made on the way there, so it costs the page load nothing
      grainAsked = true;
      makeGrain().then((url) => {
        if (!url) return;
        grain = url;
        grainFrame = -1;
        stage.style.opacity = '';
        stage.style.webkitMaskImage = `url(${url})`;
        stage.style.webkitMaskSize = `100% ${GRAIN.frames * 100}%`;
      }).catch((err) => console.warn('Grain mask unavailable; the slides will fade instead.', err));
    }
    if (box.top < vh && box.bottom > 0) {
      const pinEnd = workTop + workRange;
      const shown = ramp(y, workTop, workTop + vh * REVEAL) * (1 - ramp(y, pinEnd - vh * REVEAL, pinEnd));
      stage.style.visibility = shown > 0 ? 'visible' : 'hidden';
      const step = Math.round(shown * (GRAIN.frames - 1));
      if (step !== grainFrame) {
        grainFrame = step;
        const whole = step === GRAIN.frames - 1;
        stage.classList.toggle('grained', Boolean(grain) && !whole);
        if (!grain) stage.style.opacity = shown.toFixed(3);
        else if (!whole) stage.style.webkitMaskPosition = `0 ${((step / (GRAIN.frames - 1)) * 100).toFixed(3)}%`;
      }

      const through = clamp((y - workTop - vh * REVEAL) / slideRange);
      const u = through * (slides.length - 1);
      const at = Math.min(Math.floor(u), slides.length - 1);
      const turnOver = ease(ramp(u - at, SLIDE_HOLD, 1));
      slideNow = turnOver > 0.5 ? Math.min(at + 1, slides.length - 1) : at;
      if (shownSlide !== at) {
        slides.forEach((slide, i) => {
          slide.el.style.clipPath = i <= at ? 'none' : 'inset(100% 0 0 0)';
          slide.body.style.transform = '';
          slide.el.classList.toggle('passed', i < at);
        });
        shownSlide = at;
      }
      slides[at].body.style.transform = `translateY(${(-turnOver * 10).toFixed(2)}svh)`;
      const incoming = slides[at + 1];
      if (incoming) {
        incoming.el.style.clipPath = turnOver > 0 ? waveClip(turnOver) : 'inset(100% 0 0 0)';
        incoming.body.style.transform = `translateY(${((1 - turnOver) * 14).toFixed(2)}svh)`;
      }
      ticks.forEach((tick, i) => { tick.style.transform = `scaleX(${clamp(through * ticks.length - i).toFixed(3)})`; });
    }

    // The close: the particles settle into the landscape, then scrolling walks you into the light.
    const closing = clamp((y - closeTop) / (vh * CLOSE_SCREENS));
    const walk = ease(ramp(closing, CLOSE_PUSH[0], CLOSE_PUSH[1]));
    const white = ease(ramp(closing, CLOSE_WHITE[0], CLOSE_WHITE[1]));
    const desertShown = (fromName === 'desert' && toName === 'desert' ? 1 : toName === 'desert' ? ramp(morph, 0.6, 1) : 0) * (1 - ramp(closing, CLOSE_WHITE[0], CLOSE_WHITE[0] + 0.14));
    const nearClose = y > closeTop - vh * 1.9;
    // The photographic landscape and its independent live grain become visible as the footer arrives.
    // The original global point-cloud renderer recedes instead of obscuring the source image.
    const sceneArrival = livingDesert ? ramp(y, closeTop - vh * 0.92, closeTop - vh * 0.08) : 0;
    if (nearClose && !desertAsked) {
      desertAsked = true;
      startLivingDesert(livingCanvas).then((layer) => { livingDesert = layer; })
        .catch((error) => console.warn('Living Desert unavailable; keeping legacy footer fallback.', error));
    }
    if (nearClose && livingDesert) livingDesert.draw(closing, time);
    livingCanvas.style.opacity = (sceneArrival * (1 - white)).toFixed(3);
    scene.canvas.style.opacity = (1 - sceneArrival).toFixed(3);
    ghost.style.visibility = nearClose && !livingDesert ? 'visible' : 'hidden';
    if (nearClose) {
      const arrive = ramp(y, closeTop - vh * 1.6, closeTop - vh * 0.9);
      // Keep the source landscape readable while the independent dots and contours breathe over it.
      // The image and shader share a focal point and push forward together, without shrinking the figure.
      ghost.style.opacity = livingDesert ? '0' : (arrive * 0.82 * (1 - white)).toFixed(3);
      ghost.style.transform = `scale(${(1 + walk * 0.55).toFixed(4)})`;
      whiteLayer.style.opacity = white.toFixed(3);
      closeLead.style.opacity = (ramp(y, closeTop - vh * 0.15, closeTop + vh * 0.12) * (1 - ramp(closing, 0.73, 0.82))).toFixed(3);
      closeTitle.style.opacity = ramp(y, closeTop + vh * CLOSE_SCREENS * 0.96, closeTop + vh * (CLOSE_SCREENS + 0.35));
      closeDetails.style.opacity = ramp(y, closeTop + vh * (CLOSE_SCREENS + 0.65), closeTop + vh * (CLOSE_SCREENS + 1.05));
      root.classList.toggle('whiteout', white > 0.55);
    }

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
      turn,
      pan,
      zoom,
      fly: play * 16 + time * 0.05,
      walk,
      focus,
      body,
      bustScale,
      dust: SURFACE_DOTS,
      fade: ramp(closing, CLOSE_WHITE[0] - 0.04, CLOSE_WHITE[1]),
      feet: desertFeet,
      strands: desertShown,
    });
  };
  raf = requestAnimationFrame(frame);
}

score.init(document.querySelector('[data-sound-toggle]'), isCalm);

document.fonts.ready.then(() => { if (!isCalm()) startMotion(); });
