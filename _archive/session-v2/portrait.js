// The hero portrait: ~20,000 points stippled from my photo (scripts/make-portrait.py).
// They gather from dust on load, drift, part around the pointer, and burn orange where
// the playhead crosses. The stippled <img> underneath is the Calm mode and no-JS version.
const VERT = `
attribute vec2 home;
attribute float seed;
uniform vec4 uBox;
uniform vec2 uMouse;
uniform float uAspect, uTime, uForm, uPlay, uLevel, uSize;
varying float vHeat;

void main() {
  vec2 p = uBox.xy + home * uBox.zw;
  float a = seed * 6.2831;
  vec2 drift = vec2(cos(a + uTime * 0.3), sin(a * 1.7 + uTime * 0.25)) * (0.0016 + uLevel * 0.012);
  vec2 dust = vec2(cos(a * 3.0), sin(a * 5.0) - 0.5) * (0.15 + seed * 0.5);
  float away = 1.0 - uForm;
  p += drift + dust * away * away;
  vec2 d = (p - uMouse) * vec2(uAspect, 1.0);
  float push = exp(-dot(d, d) * 70.0);
  p += normalize(d + 0.0001) * push * 0.035 / vec2(uAspect, 1.0);
  vHeat = exp(-pow((p.x - uPlay) * 55.0, 2.0));
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  gl_PointSize = uSize * (1.0 + vHeat * 0.9);
}`;

const FRAG = `
precision mediump float;
varying float vHeat;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(mix(vec3(0.953, 0.933, 0.894), vec3(1.0, 0.541, 0.165), vHeat), 1.0);
}`;

const FORM_MS = 2200;
const POINT_CSS_PX = 1.1;

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

function attribute(gl, program, name, size, type, data) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, type, type === gl.UNSIGNED_SHORT, 0, 0);
}

// Returns { setPlay(x 0..1), setLevel(0..1), stop() }, or null if WebGL or the points aren't available.
export async function startPortrait(session, figure) {
  const canvas = document.createElement('canvas');
  canvas.className = 'particles';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;

  let program;
  let points;
  try {
    program = buildProgram(gl);
    const res = await fetch('/hero/portrait.bin');
    if (!res.ok) throw new Error(`portrait.bin returned ${res.status}`);
    points = new Uint16Array(await res.arrayBuffer());
  } catch (err) {
    console.warn('Particle portrait unavailable; showing the still.', err);
    return null;
  }

  gl.useProgram(program);
  const count = points.length / 2;
  attribute(gl, program, 'home', 2, gl.UNSIGNED_SHORT, points);
  attribute(gl, program, 'seed', 1, gl.FLOAT, Float32Array.from({ length: count }, () => Math.random()));
  const u = Object.fromEntries(['uBox', 'uMouse', 'uAspect', 'uTime', 'uForm', 'uPlay', 'uLevel', 'uSize']
    .map((name) => [name, gl.getUniformLocation(program, name)]));
  gl.clearColor(0, 0, 0, 0);

  const state = { play: 2, level: 0, mouse: [-9, -9] };

  const layout = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = session.getBoundingClientRect();
    const fig = figure.getBoundingClientRect();
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(u.uAspect, box.width / box.height);
    gl.uniform1f(u.uSize, POINT_CSS_PX * dpr);
    gl.uniform4f(u.uBox, (fig.left - box.left) / box.width, (fig.top - box.top) / box.height, fig.width / box.width, fig.height / box.height);
  };
  const resizer = new ResizeObserver(layout);
  resizer.observe(session);

  const onPointer = (e) => {
    const box = session.getBoundingClientRect();
    state.mouse = [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height];
  };
  const onLeave = () => { state.mouse = [-9, -9]; };
  session.addEventListener('pointermove', onPointer, { passive: true });
  session.addEventListener('pointerleave', onLeave);

  let visible = true;
  const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  seen.observe(session);

  session.prepend(canvas);
  layout();
  const t0 = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - t0) / FORM_MS;
    const form = t >= 1 ? 1 : 1 - (1 - t) ** 3;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.uTime, (now - t0) / 1000);
    gl.uniform1f(u.uForm, form);
    gl.uniform1f(u.uPlay, state.play);
    gl.uniform1f(u.uLevel, state.level);
    gl.uniform2f(u.uMouse, state.mouse[0], state.mouse[1]);
    gl.drawArrays(gl.POINTS, 0, count);
  };
  raf = requestAnimationFrame((now) => {
    frame(now);
    document.documentElement.classList.add('particles-on');
  });

  const fallBack = () => {
    cancelAnimationFrame(raf);
    resizer.disconnect();
    seen.disconnect();
    session.removeEventListener('pointermove', onPointer);
    session.removeEventListener('pointerleave', onLeave);
    canvas.remove();
    document.documentElement.classList.remove('particles-on');
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallBack(); });

  return {
    setPlay: (x) => { state.play = x; },
    setLevel: (v) => { state.level = v; },
    stop: () => { fallBack(); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
