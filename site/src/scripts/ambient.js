import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import { isCalm } from './calm.js';
import { startCursor } from './cursor.js';
import { startDisintegrate } from './disintegrate.js';

// Release pages: the same particle cloud, quieter. As you read toward the next question, the dust gathers into a question mark.
const PARTICLES = innerWidth < 640 ? 9000 : 14000;
const clamp = (v) => Math.min(1, Math.max(0, v));
const root = document.documentElement;

function start() {
  const scene = createScene(PARTICLES);
  if (!scene) return;

  const lenis = new Lenis({ lerp: 0.09, anchors: true });
  scene.canvas.classList.add('scene-quiet');
  document.body.prepend(scene.canvas);
  root.classList.add('scene-on');

  const layout = () => {
    scene.resize();
    scene.setShape('field', shapes.field(PARTICLES, innerWidth / innerHeight));
    const aspect = innerWidth / innerHeight;
    const mark = shapes.words(PARTICLES, ['?'], aspect, 0.5);
    if (innerWidth >= 900) for (let k = 0; k < mark.length; k += 4) mark[k] += aspect * 0.62; // beside the column, not behind the words
    scene.setShape('mark', mark);
  };
  layout();

  let lastWidth = innerWidth;
  const onResize = () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    layout();
  };
  addEventListener('resize', onResize, { passive: true });

  const dust = startDisintegrate(document.querySelectorAll('[data-disintegrate]'));
  const cursor = startCursor();
  const t0 = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    lenis.raf(now);
    const time = (now - t0) / 1000;
    const range = root.scrollHeight - innerHeight;
    cursor.tick();
    const aspect = innerWidth / innerHeight;
    const mouse = cursor.on ? [((cursor.x / innerWidth) * 2 - 1) * aspect, 1 - (cursor.y / innerHeight) * 2] : [-9, -9];
    dust.tick(time);
    scene.draw({
      from: 'field',
      to: 'mark',
      morph: range > 0 ? clamp(scrollY / range) : 0,
      time,
      mouse,
    });
  };
  raf = requestAnimationFrame(frame);
}

document.fonts.ready.then(() => { if (!isCalm()) start(); });
