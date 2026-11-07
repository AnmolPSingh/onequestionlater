import Lenis from 'lenis';
import { buildProgram, createScene } from './scene.js';
import { createClose } from './close.js';
import { createDust, fieldFor } from './cymatics.js';
import { createScore } from './score.js';
import { createTone } from './tone.js';
import { isCalm } from './calm.js';
import { startCursor } from './cursor.js';

// The philosophy in dust shaped by sound. The page pins and the scroll is the playhead: each beat is a
// 3D form (cymatics.js) filling the screen behind the words, and the same dust flows from one form to
// the next at its own pace while the camera drifts round it. Lists unfold line by line and the form
// grows with them. With sound on, the tone that shapes the dust glides under Reverie. Then the dust gives
// way to the home page's close (close.js): the desert, the walk into the light, the contact details.
// The HTML is already the finished page, so reduced motion simply never starts any of this.
const GRAINS = innerWidth < 640 ? 12000 : 30000;
const FOCAL = 2; // how wide the lens is: the ring nearly fills the screen's height
const CAM_EASE = 0.025; // how slowly the camera follows a new form's viewpoint
const LEAN = 0.12; // radians the view leans toward the pointer
const STEP = 1; // screens of scroll per beat: six beats, six scrolls; matches .journey's height in philosophy.css
const DESERT = innerWidth < 640 ? 26000 : 58000; // the close's dots, as on the home page
const WORDS_IN = [0.12, 0.34]; // share of a beat over which its words arrive
const WORDS_OUT = [0.82, 1]; // and leave, while the next figure gathers
const UNFOLD = [0.18, 0.62]; // a beat's list arrives line by line across this share
const LEAVE_MS = 650;
const PAPER = [0.953, 0.933, 0.894];
const NEON = [0.957, 0.973, 1];
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (v, a, b) => clamp((v - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);

const VERT = `
attribute vec3 aGrain;
attribute float aSeed, aLit;
uniform vec2 uTurn; // the camera's yaw and pitch
uniform float uDist, uAspect, uSize;
varying float vSeed, vLit, vFog;
void main() {
  vec3 p = aGrain;
  float cy = cos(uTurn.x), sy = sin(uTurn.x), cp = cos(uTurn.y), sp = sin(uTurn.y);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
  float depth = uDist - p.z;
  if (depth < 0.15) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; } // behind the camera
  gl_Position = vec4(p.x * ${FOCAL.toFixed(2)} / depth / uAspect, p.y * ${FOCAL.toFixed(2)} / depth, 0.0, 1.0);
  gl_PointSize = uSize * (0.5 + aSeed * aSeed * 1.4) * (1.0 + aLit * 0.4) * clamp(3.4 / depth, 0.4, 3.0);
  vSeed = aSeed;
  vLit = aLit;
  vFog = clamp(1.4 - depth / 7.0, 0.12, 1.0) * smoothstep(0.15, 0.9, depth); // far dust fades, and so does dust about to pass you
}`;

// Grains of sand, not dots: each one an irregular little stone, a different size and shade.
const FRAG = `
precision mediump float;
uniform vec3 uPaper, uNeon;
varying float vSeed, vLit, vFog;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a = atan(p.y, p.x);
  float edge = 0.42 + 0.07 * sin(a * 3.0 + vSeed * 40.0) + 0.05 * sin(a * 5.0 + vSeed * 91.0);
  float shape = 1.0 - smoothstep(edge - 0.12, edge, length(p));
  float tone = 0.35 + 0.6 * fract(vSeed * 13.7);
  vec3 colour = mix(uPaper * tone, uNeon, vLit);
  gl_FragColor = vec4(colour, shape * (0.55 + 0.4 * vLit) * vFog);
}`;

function createStage(count) {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  let program;
  try { program = buildProgram(gl, VERT, FRAG); } catch (err) { console.warn('Dust failed to compile; showing the static page.', err); return null; }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive, so where dust gathers it reads brighter
  gl.clearColor(0, 0, 0, 0);
  const u = Object.fromEntries(['uTurn', 'uDist', 'uAspect', 'uSize', 'uPaper', 'uNeon'].map((name) => [name, gl.getUniformLocation(program, name)]));
  gl.uniform3fv(u.uPaper, PAPER);
  gl.uniform3fv(u.uNeon, NEON);

  const attribute = (name, size, data, usage) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return buffer;
  };
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();
  attribute('aSeed', 1, seeds, gl.STATIC_DRAW);
  const grainBuffer = attribute('aGrain', 3, new Float32Array(count * 3), gl.DYNAMIC_DRAW);
  const litBuffer = attribute('aLit', 1, new Float32Array(count), gl.DYNAMIC_DRAW);

  return {
    canvas,
    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(u.uAspect, innerWidth / innerHeight);
      gl.uniform1f(u.uSize, (innerWidth < 640 ? 1.7 : 2.2) * dpr);
    },
    draw(pos, glow, cam) {
      gl.uniform2f(u.uTurn, cam.yaw, cam.pitch);
      gl.uniform1f(u.uDist, cam.dist);
      gl.bindBuffer(gl.ARRAY_BUFFER, grainBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.bindBuffer(gl.ARRAY_BUFFER, litBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, glow);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);
    },
  };
}

try { sessionStorage.setItem('loaded', '1'); } catch { /* private mode: the home page's loader just plays */ }

async function start() {
  const stage = createStage(GRAINS);
  const desert = createScene(DESERT);
  if (!stage || !desert) return;
  const dust = createDust(GRAINS);
  const lenis = new Lenis({ lerp: 0.09 });
  const close = createClose(desert, lenis, DESERT);
  desert.canvas.style.opacity = '0';
  document.body.prepend(desert.canvas);
  document.body.prepend(stage.canvas);
  root.classList.add('scene-on', 'journey-on');
  await new Promise(requestAnimationFrame);

  const track = document.querySelector('[data-journey]');
  const counter = document.querySelector('[data-count-out]');
  const hudMode = document.querySelector('[data-hud-mode]');
  const hudHz = document.querySelector('[data-hud-hz]');
  const chapters = [...document.querySelectorAll('[data-to]')];
  const rail = document.querySelector('.rail');
  const beats = [...track.querySelectorAll('.beat')].map((el) => ({ el, count: el.dataset.count, lines: [...el.querySelectorAll('[data-unfold] li, [data-line]')] })); // in reading order
  let top = 0;

  const layout = () => {
    stage.resize();
    top = track.getBoundingClientRect().top + scrollY;
    desert.resize();
    close.layout();
    close.build();
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

  // The chapter rail jumps to the middle of a beat, where its words are fully in.
  chapters.forEach((link) => link.addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo(top + innerHeight * STEP * (Number(link.dataset.to) + 0.5));
  }));

  // Reaching the arrow carries on rather than stops: the dust is thrown outward and you follow it.
  let leaving = false;
  document.querySelector('.beat-on').addEventListener('click', (e) => {
    e.preventDefault();
    const { href } = e.currentTarget;
    leaving = true;
    dust.set({ ...fieldFor(3, 0), amp: 14 });
    setTimeout(() => { location.href = href; }, LEAVE_MS);
  });

  const score = createScore();
  score.init(document.querySelector('[data-sound-toggle]'), isCalm, false);
  const tone = createTone();
  const cursor = startCursor();
  let shown = -1;
  let fieldKey = '';
  let last = performance.now();
  const cam = { ...fieldFor(0, 0).cam };
  let lean = [0, 0];

  const frame = (now) => {
    requestAnimationFrame(frame);
    lenis.raf(now);
    const dt = (now - last) / 1000;
    last = now;
    const vh = innerHeight;
    cursor.tick();

    // Where the playhead is: which beat, and how far into it.
    const p = clamp((scrollY - top) / (vh * STEP), 0, beats.length - 0.0001);
    const at = Math.floor(p);
    const lastBeat = beats.length - 1;
    let lines = 0;
    beats.forEach((beat, j) => {
      const s = p - j;
      const o = ease(ramp(s, WORDS_IN[0], WORDS_IN[1])) * (j === lastBeat ? 1 : 1 - ease(ramp(s, WORDS_OUT[0], WORDS_OUT[1])));
      beat.o = j === 0 && p < WORDS_OUT[0] ? 1 : o; // the first words are already there when you arrive
      beat.el.style.opacity = beat.o.toFixed(3);
      beat.el.style.filter = beat.o < 1 ? `blur(${((1 - beat.o) * 6).toFixed(1)}px)` : '';
      beat.el.classList.toggle('on', beat.o > 0.02);
      if (beat.lines.length) {
        const k = ramp(s, UNFOLD[0], UNFOLD[1]) * (beat.lines.length + 1);
        beat.lines.forEach((li, i) => { li.style.opacity = clamp(k - i).toFixed(3); });
        if (j === at) lines = clamp(Math.ceil(k - 0.5), 0, beat.lines.length); // lines more than half in
      }
    });
    if (at !== shown) {
      shown = at;
      counter.textContent = beats[at].count;
      chapters.forEach((link) => { if (Number(link.dataset.to) === at) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
    }

    // The form for what's being said. Only a new form is handed over; the dust does the rest.
    const key = `${at}:${lines}`;
    if (key !== fieldKey && !leaving) {
      fieldKey = key;
      const field = fieldFor(at, lines);
      dust.set(field);
      hudMode.textContent = field.label;
      hudHz.textContent = field.hz ? `${field.hz} HZ` : 'WHITE';
    }

    // The camera drifts to each form's viewpoint, turning slowly the whole time. The pointer leans the
    // view a little toward it.
    const field = dust.field;
    cam.pitch += (field.cam.pitch - cam.pitch) * CAM_EASE;
    cam.yaw += (field.cam.yaw + Math.sin(now / 9000) * 0.25 - cam.yaw) * CAM_EASE;
    cam.dist += (field.cam.dist - cam.dist) * CAM_EASE;
    const target = cursor.on ? [(cursor.x / innerWidth - 0.5) * 2 * LEAN, (cursor.y / vh - 0.5) * 2 * LEAN] : [0, 0];
    lean = [lean[0] + (target[0] - lean[0]) * 0.05, lean[1] + (target[1] - lean[1]) * 0.05];
    // As the close comes up, the dust fades and the desert takes over; the beat's tone fades with it.
    const { walk, focus, ground } = close.tick(now, scrollY, cursor);
    const handover = ramp(scrollY, close.top - vh * 1.2, close.top - vh * 0.3);
    stage.canvas.style.opacity = (1 - handover).toFixed(3);
    desert.canvas.style.opacity = handover.toFixed(3);
    rail.classList.toggle('gone', handover > 0.3); // the chapters belong to the philosophy, not the close
    const on = root.classList.contains('sound-on');
    tone.play(field.hz ?? 0, on && handover < 0.5);
    if (handover < 1) {
      dust.step(dt, score.levels().low * 0.8);
      stage.draw(dust.pos, dust.glow, { yaw: cam.yaw + lean[0], pitch: cam.pitch + lean[1], dist: cam.dist });
    }
    if (handover > 0 && desert.has('desert')) {
      const light = cursor.on ? [((cursor.x / innerWidth) * 2 - 1) * (innerWidth / vh), 1 - (cursor.y / vh) * 2] : [0, 0];
      desert.draw({ from: 'desert', to: 'desert', morph: 1, time: now / 1000, mouse: light, walk, focus, ground });
    }
  };
  requestAnimationFrame(frame);
}

document.fonts.ready.then(() => { if (!isCalm()) start(); });
