import { gsap } from 'gsap';

// The ink portal: a noise-warped ink blob on paper, behind the story. Its radius is
// scrubbed by scroll, so it swallows the screen to enter a night chapter and shrinks
// away to reveal a paper one.
const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uR;
uniform vec3 uInk;
uniform vec3 uPaper;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * 2.0;
  vec2 q = p * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.05;
  float w = fbm(q * 1.3 + vec2(t, -t * 0.7));
  float grow = clamp(uR, 0.0, 1.0);
  float d = length(p) + (w - 0.5) * 0.4 * grow;
  float ink = 1.0 - smoothstep(uR - 0.25, uR, d);
  float halo = (1.0 - smoothstep(uR, uR + 0.4, d)) * (1.0 - ink) * grow;
  vec3 col = mix(uPaper, uInk, ink);
  col = mix(col, mix(uPaper, uInk, 0.4), halo * (0.35 + 0.5 * w));
  // mod keeps the hash input small enough for mediump (fp16) GPUs.
  col += (hash(mod(gl_FragCoord.xy, 64.0) + fract(uTime) * 61.0) - 0.5) * 0.05;
  gl_FragColor = vec4(col, 1.0);
}`;

// Wider on portrait screens so the opening title stays on ink, not on the halo.
const OPEN = window.innerWidth < window.innerHeight ? 1.15 : 0.95;
const FULL = 2.4;
// Radius once each section fills the screen. Night chapters are FULL ink, paper ones 0.
const STEPS = [['#ch-01', FULL], ['#ch-06', 0], ['#ch-07', FULL], ['#ask', 0], ['#close', OPEN]];
const FRAME_MS = 33;
const RENDER_SCALE = 0.75;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function buildProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

// Returns a stop function. Without WebGL the sections keep their flat colours.
export function startPortal() {
  const canvas = document.createElement('canvas');
  canvas.className = 'portal';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return () => {};

  let program;
  try {
    program = buildProgram(gl);
  } catch (err) {
    console.warn('Ink portal shader failed; using flat colours.', err);
    return () => {};
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const uRes = uniform('uRes');
  const uTime = uniform('uTime');
  const uR = uniform('uR');
  const css = getComputedStyle(document.documentElement);
  gl.uniform3fv(uniform('uInk'), rgb(css.getPropertyValue('--ink').trim()));
  gl.uniform3fv(uniform('uPaper'), rgb(css.getPropertyValue('--paper').trim()));

  const state = { r: OPEN };
  const tweens = [];
  let from = OPEN;
  for (const [selector, to] of STEPS) {
    const trigger = document.querySelector(selector);
    if (!trigger) continue;
    tweens.push(gsap.fromTo(state, { r: from }, {
      r: to,
      ease: 'power2.inOut',
      immediateRender: false,
      scrollTrigger: { trigger, start: 'top bottom', end: 'top 15%', scrub: true },
    }));
    from = to;
  }

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * RENDER_SCALE;
    const w = Math.round(innerWidth * scale);
    const h = Math.round(innerHeight * scale);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  };

  document.body.prepend(canvas);
  const t0 = performance.now();
  let last = 0;
  let raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    resize();
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform1f(uR, state.r);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  raf = requestAnimationFrame((now) => {
    frame(now);
    document.documentElement.classList.add('portal-on');
  });

  const fallBack = () => {
    cancelAnimationFrame(raf);
    canvas.remove();
    document.documentElement.classList.remove('portal-on');
  };
  // A lost context paints black; drop back to the sections' flat colours instead.
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallBack(); });

  return () => {
    fallBack();
    tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
