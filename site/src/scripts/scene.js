// One particle cloud behind the whole page. Every frame it mixes two shapes per particle,
// each particle starting at its own moment and swirling mid-flight, and every shape keeps
// its own live motion, so nothing ever settles completely.

// How the figure is posed and put on screen, shared with the sculpture so its dots sit on its surface.
export const FIGURE_GLSL = `
uniform vec2 uMouse, uLean, uPan;
uniform float uAspect, uTime, uTurn, uZoom;
const float CAMERA = 2.8;

// Turn a body about its centre line, lean it toward the light, then place it on screen.
vec3 turned(vec3 p) {
  float c = cos(uTurn + uLean.x), s = sin(uTurn + uLean.x);
  vec3 q = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  float cn = cos(uLean.y), sn = sin(uLean.y);
  return vec3(q.x, cn * q.y - sn * q.z, sn * q.y + cn * q.z);
}

vec3 placed(vec3 q, float depth) {
  q *= uZoom;
  q.z *= depth;
  q.xy += uPan * (CAMERA - q.z) / CAMERA; // a pan in screen units, whatever the depth
  return q;
}

vec4 onScreen(vec3 p) {
  float scale = CAMERA / (CAMERA - p.z);
  return vec4(p.x * scale / uAspect, p.y * scale, -p.z * 0.2, 1.0);
}`;

const VERT = `
precision highp float;
attribute vec4 aFrom;
attribute vec4 aTo;
attribute float aSeed;
attribute vec3 aNormal;
uniform vec2 uFocus;
uniform float uMorph, uSize, uLevel, uHigh, uGlobeX, uFly, uWalk;
varying vec3 vColor;
varying float vAlpha;
${FIGURE_GLSL}

const float EXPOSURE = 0.6; // light adds up where dots crowd, as it does on a real surface
const vec3 PAPER = vec3(0.953, 0.933, 0.894);
const vec3 ONAIR = vec3(0.957, 0.973, 1.0); // neon white, matching --onair
const vec3 KEY = normalize(vec3(-0.62, 0.42, 0.66)); // the light on the figure, from high on the left
const float FAR = 3.0; // how much further the horizon is than the nearest sand, for the walk

float isHot(float w) { return (w >= 5.0 && w < 6.0) || (w >= 7.0 && w < 8.0) ? 1.0 : 0.0; }
float isFine(float w) { return (w >= 8.0 && w < 9.0) || w >= 10.0 ? 1.0 : 0.0; }
bool isGlobe(float w) { return (w >= 2.0 && w < 3.0) || (w >= 5.0 && w < 6.0); }

float gLit; // how much light a point has, set by live()
float gGrow; // how much nearer a dot has come, set by live()
vec3 gFacing; // which way a dot on the relief faces, once turned

// Sand slides under you and the horizon comes up. A dot passes the camera when the walk reaches it.
vec3 walked(vec3 p, bool figure) {
  float start = 1.0 + (1.0 - p.z) * FAR;
  float left = start - uWalk;
  float near = start / max(left, 0.05);
  float phase = aSeed * 6.2831;
  float t = uTime;
  // Every dot twinkles on its own clock, so the scene is alive even when you stop scrolling.
  float twinkle = 0.5 + 0.5 * sin(t * (1.1 + aSeed * 2.2) + phase * 7.0);
  gLit = smoothstep(0.03, 0.4, left) * mix(0.3, 1.1, twinkle);
  gGrow = min(sqrt(near), 5.0);
  vec2 q = uFocus + (p.xy - uFocus) * near;
  if (figure) {
    q += vec2(sin(t * 1.9 + phase * 5.0), cos(t * 1.6 + phase * 3.0)) * 0.008 * gGrow; // I hold my shape and shimmer
  } else {
    // Wind: each grain blows along the sand, fading in and out at the ends of its run, in slow gusts.
    float run = fract(t * (0.07 + aSeed * 0.11) + aSeed * 9.0);
    float gust = 0.65 + 0.35 * sin(t * 0.4 + p.y * 3.0);
    q.x += (run - 0.5) * 0.2 * gust * gGrow;
    q.y += sin(t * 0.9 + phase * 3.0) * 0.012 * gGrow;
    gLit *= 1.7 * sin(run * 3.14159);
  }
  return vec3(q, 0.0);
}

vec3 live(vec4 s) {
  float code = floor(s.w + 0.001);
  vec3 p = s.xyz;
  float phase = aSeed * 6.2831;
  gLit = 1.0;
  gGrow = 1.0;
  gFacing = vec3(0.0, 0.0, 1.0);
  if (code > 11.5) {
    // Me, lit the way Elimar lights a scene: dots where light falls, a few larger flecks. Life comes from
    // movement, not flicker: each dot wanders on its own, the shadows and edges fray more than the lit face,
    // and a few lift off as dust and drift out into the dark before they come back.
    float luma = fract(s.w + 0.0005) / 0.9;
    float big = step(0.86, fract(aSeed * 7.13));
    float glint = step(0.97, fract(aSeed * 13.0)) * pow(max(sin(uTime * (0.3 + aSeed * 0.4) + phase * 20.0), 0.0), 24.0); // swells and fades over a second or two
    float twinkle = 0.85 + 0.15 * sin(uTime * (0.8 + aSeed * 1.7) + phase * 9.5);
    p.xy += vec2(sin(uTime * (0.3 + aSeed * 0.5) + phase * 31.0), cos(uTime * (0.25 + aSeed * 0.4) + phase * 17.0)) * mix(0.009, 0.0025, luma);
    float dust = step(0.93, fract(aSeed * 3.71));
    float run = fract(uTime * (0.04 + aSeed * 0.05) + aSeed * 11.0);
    float lift = run * run;
    p.xy += dust * vec2(0.5 + sin(phase * 7.0) * 0.3 + sin(uTime * 0.3 + phase) * 0.05, 0.25 + cos(phase * 5.0) * 0.2) * lift;
    gLit = twinkle * (1.0 + big * 0.6) * mix(1.0, smoothstep(0.0, 0.06, run) * (1.0 - smoothstep(0.5, 1.0, run)) * 1.2 / max(luma, 0.2), dust) + glint * 1.2;
    gGrow = mix(1.0, 1.8, big) * (1.0 + glint * 0.6) * mix(1.0, 1.5, dust);
    return placed(p, 0.55);
  } else if (code > 9.5) {
    return walked(p, code > 10.5);
  } else if (code > 8.5) {
    // Carried past the camera, fading in far off and out just before they'd hit it.
    p.z = mod(p.z + uFly, 5.4) - 3.0;
    gLit = smoothstep(-3.0, -1.8, p.z) * smoothstep(2.4, 1.5, p.z);
    return p;
  } else if (code > 7.5) {
    gFacing = turned(aNormal);
    float toLight = max(dot(gFacing, KEY), 0.0);
    float rim = pow(1.0 - max(gFacing.z, 0.0), 2.0);
    gLit = (0.3 + 1.2 * toLight * toLight + rim * 0.8) * smoothstep(-0.05, 0.2, gFacing.z); // dots on the far side of the head stay dark
    return placed(turned(p), 0.55);
  } else if (code < 0.5) {
    p.xy += vec2(cos(phase + uTime * 0.5), sin(phase * 1.7 + uTime * 0.42)) * (0.0012 + uLevel * 0.0015);
  } else if (code > 6.5) {
    p.y += sin(p.x * 2.6 - uTime * 1.3) * 0.17 * (0.75 + 0.25 * sin(p.x * 0.7 + uTime * 0.4));
  } else if (code > 5.5) {
    p.xy += vec2(sin(uTime * 23.0 + phase * 9.0), cos(uTime * 19.0 + phase * 7.0)) * 0.012;
  } else if (code < 1.5) {
    p.y *= 0.62 + 0.38 * sin(uTime * 2.1 + p.x * 3.2) + uLevel * 0.1;
  } else if (code < 2.5 || code > 4.5) {
    float a = -1.2 + uTime * 0.12;
    float c = cos(a), s2 = sin(a);
    p = vec3(c * p.x + s2 * p.z, p.y, -s2 * p.x + c * p.z);
    float tilt = 0.3;
    p = vec3(p.x, cos(tilt) * p.y - sin(tilt) * p.z, sin(tilt) * p.y + cos(tilt) * p.z);
    p.x += uGlobeX;
  } else if (code < 3.5) {
    float u = p.x, v = p.y, strand = p.z;
    float ph = u * 2.7 + uTime * 0.24;
    float twist = cos(ph + strand * 1.1);
    p = vec3(u * uAspect * 1.3, sin(ph + strand * 1.1) * 0.44 + sin(ph * 0.5 - uTime * 0.11) * 0.14 + v * 0.17 * twist, v * 0.4 * sin(ph));
  } else {
    p.y = mod(p.y + uTime * (0.006 + aSeed * 0.01) + 1.4, 2.8) - 1.4;
    p.x += sin(uTime * 0.2 + phase) * 0.01;
  }
  return p;
}

void main() {
  float delay = aSeed * 0.4;
  float k = clamp((uMorph - delay) / 0.6, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 from = live(aFrom);
  float litFrom = gLit;
  float growFrom = gGrow;
  vec3 facingFrom = gFacing;
  vec3 to = live(aTo);
  vec3 p = mix(from, to, k);
  float lit = mix(litFrom, gLit, k);
  float grow = mix(growFrom, gGrow, k);
  vec3 facing = mix(facingFrom, gFacing, k);

  // Mid-flight, particles leave the straight line and swirl.
  float flight = sin(k * 3.14159) * min(distance(from, to) * 3.0, 1.0); // a dot that isn't going anywhere stays put
  float a = aSeed * 40.0 + p.y * 2.4 + uTime * 0.3;
  p += vec3(cos(a) + sin(p.y * 3.1), sin(a * 1.3) + cos(p.x * 2.3), sin(a * 0.7)) * flight * 0.3;

  float scale = CAMERA / (CAMERA - p.z);

  // The pointer is a light, not a force: it falls across the surface and nothing is pushed.
  vec2 d = p.xy * scale - uMouse;
  float light = exp(-dot(d, d) * 7.0) * (0.35 + 0.9 * max(dot(facing, normalize(vec3(-d, 0.42))), 0.0));

  // With the track on, the bass barely breathes the cloud and a few highs catch the light.
  // Deliberately slight: you should feel it more than see it.
  p.xy *= 1.0 + uLevel * 0.005;
  float flare = uHigh * step(0.975, fract(aSeed * 13.0 + floor(uTime * 7.0) * 0.37));

  float alphaFrom = fract(aFrom.w + 0.0005) / 0.9;
  float alphaTo = fract(aTo.w + 0.0005) / 0.9;
  float alphaLight = mix(alphaFrom, alphaTo, k);
  vAlpha = alphaLight * lit;
  if (isGlobe(aFrom.w) || isGlobe(aTo.w)) vAlpha *= mix(0.3, 1.0, smoothstep(-0.8, 0.4, p.z));
  vAlpha = (vAlpha + light * 1.1 + flare * 0.12) * EXPOSURE;

  float hot = mix(isHot(aFrom.w), isHot(aTo.w), k);
  vColor = mix(PAPER, ONAIR, hot);

  gl_Position = onScreen(p);
  gl_Position.z -= 0.004; // just proud of the sculpture, so its dots aren't lost in its surface
  // Mostly dust, with the odd bigger star among it.
  float fine = fract(aSeed * 7.13);
  float grain = mix(0.72 + aSeed * 0.6, 0.55 + 0.3 * alphaLight + 1.1 * fine * fine * fine, mix(isFine(aFrom.w), isFine(aTo.w), k));
  gl_PointSize = uSize * scale * grain * grow * (1.0 + flare * 0.25 + light * 0.3);
}`;

const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  gl_FragColor = vec4(vColor, min(vAlpha * smoothstep(0.25, 0.01, d), 1.0));
}`;

// The living dark behind everything: slow smoke and fine grain, never flat, with a faint pool of
// light behind the figure. uGround fades it out where a photo is the ground instead (the desert).
const BACK_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.999, 1.0); }`;
const BACK_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime, uAspect, uGround;
uniform vec2 uPan;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec2 q = vec2((vUv.x - 0.5) * 2.0 * uAspect, vUv.y * 2.0 - 1.0);
  float t = uTime * 0.035;
  float smoke = fbm(q * 1.1 + vec2(t, -t * 0.7) + fbm(q * 0.7 - t) * 1.6);
  vec2 d = q - uPan - vec2(0.0, 0.2);
  float pool = exp(-dot(d, d) * 0.9);
  float grain = hash(gl_FragCoord.xy + fract(uTime * 7.0) * 91.0);
  float v = 0.043 + smoke * 0.05 * (0.4 + pool) + pool * 0.03 + (grain - 0.5) * 0.024;
  gl_FragColor = vec4(vec3(v) * vec3(1.0, 0.985, 0.97), uGround);
}`;

const UNIFORMS = ['uMouse', 'uLean', 'uPan', 'uFocus', 'uAspect', 'uTime', 'uMorph', 'uSize', 'uLevel', 'uHigh', 'uGlobeX', 'uTurn', 'uZoom', 'uFly', 'uWalk'];

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

export function buildProgram(gl, vert = VERT, frag = FRAG, beforeLink = () => {}) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  beforeLink(program);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

// Returns the scene, or null without WebGL (the page then shows its static fallbacks).
export function createScene(count) {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: true, powerPreference: 'high-performance' });
  if (!gl) return null;

  let program;
  try {
    program = buildProgram(gl);
  } catch (err) {
    console.warn('Particle scene failed to compile; showing the static page.', err);
    return null;
  }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // additive, so crowded dots read as highlights
  gl.clearColor(0, 0, 0, 0);

  const u = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]));
  const aFrom = gl.getAttribLocation(program, 'aFrom');
  const aTo = gl.getAttribLocation(program, 'aTo');
  gl.enableVertexAttribArray(aFrom);
  gl.enableVertexAttribArray(aTo);

  const staticAttribute = (name, size, data) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, name);
    const bind = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind();
    return { buffer, bind };
  };
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();
  const seedAttribute = staticAttribute('aSeed', 1, seeds);
  const normalAttribute = staticAttribute('aNormal', 3, new Float32Array(count * 3));

  const back = buildProgram(gl, BACK_VERT, BACK_FRAG);
  const backU = Object.fromEntries(['uTime', 'uAspect', 'uGround', 'uPan'].map((name) => [name, gl.getUniformLocation(back, name)]));
  const backPos = gl.getAttribLocation(back, 'aPos');
  const backQuad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, backQuad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const buffers = new Map();
  let bound = [null, null];

  const scene = {
    canvas,
    gl,
    setShape(name, data) {
      if (!buffers.has(name)) buffers.set(name, gl.createBuffer());
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.get(name));
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      bound = [null, null];
    },
    has: (name) => buffers.has(name),
    setNormals(data) {
      gl.bindBuffer(gl.ARRAY_BUFFER, normalAttribute.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      bound = [null, null];
    },
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(u.uAspect, innerWidth / innerHeight);
      gl.uniform1f(u.uSize, (innerWidth < 640 ? 1.35 : 1.7) * dpr);
    },
    draw({ from, to, morph, time, mouse, level = 0, high = 0, globeX = 0, turn = 0, lean = [0, 0], pan = [0, 0], zoom = 1, fly = 0, walk = 0, focus = [0, 0], ground = 1 }) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      if (ground > 0.002) {
        gl.useProgram(back);
        gl.disable(gl.BLEND);
        gl.bindBuffer(gl.ARRAY_BUFFER, backQuad);
        gl.enableVertexAttribArray(backPos);
        gl.vertexAttribPointer(backPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(backU.uTime, time);
        gl.uniform1f(backU.uAspect, innerWidth / innerHeight);
        gl.uniform1f(backU.uGround, ground);
        gl.uniform2f(backU.uPan, pan[0], pan[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disableVertexAttribArray(backPos); // a 3-vertex array left on would be read past its end by the points
        gl.enable(gl.BLEND);
        gl.enableVertexAttribArray(aFrom);
        gl.enableVertexAttribArray(aTo);
        seedAttribute.bind();
        normalAttribute.bind();
        bound = [null, null];
      }
      gl.useProgram(program);
      if (bound[0] !== from || bound[1] !== to) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.get(from));
        gl.vertexAttribPointer(aFrom, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.get(to));
        gl.vertexAttribPointer(aTo, 4, gl.FLOAT, false, 0, 0);
        bound = [from, to];
      }
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uMorph, morph);
      gl.uniform2f(u.uMouse, mouse[0], mouse[1]);
      gl.uniform2f(u.uLean, lean[0], lean[1]);
      gl.uniform2f(u.uPan, pan[0], pan[1]);
      gl.uniform2f(u.uFocus, focus[0], focus[1]);
      gl.uniform1f(u.uWalk, walk);
      gl.uniform1f(u.uTurn, turn);
      gl.uniform1f(u.uZoom, zoom);
      gl.uniform1f(u.uFly, fly);
      gl.uniform1f(u.uLevel, level);
      gl.uniform1f(u.uHigh, high);
      gl.uniform1f(u.uGlobeX, globeX);
      gl.drawArrays(gl.POINTS, 0, count);
    },
    stop() {
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
  return scene;
}

