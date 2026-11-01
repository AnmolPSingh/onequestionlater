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

// The desert camera deliberately pushes IN for two to three scroll lengths. The 2.5D
// landscape retains its photographic depth and nearer particles expand toward the viewer.
export const PULL_GLSL = `
uniform vec2 uFocus;
uniform float uWalk;
const float PUSH = 0.65;
const float FIGURE_NEAR = 0.83; // how far down the ground my feet are
vec2 pull(vec2 q, float near) { return uFocus + (q - uFocus) * (1.0 + uWalk * PUSH * max(near, 0.2)); }`;

const VERT = `
precision highp float;
attribute vec4 aFrom;
attribute vec4 aTo;
attribute float aSeed;
attribute vec3 aNormal;
uniform float uMorph, uSize, uLevel, uHigh, uGlobeX, uFly, uFade, uFeet, uDust;
varying vec3 vColor;
varying float vAlpha;
${FIGURE_GLSL}
${PULL_GLSL}

const float EXPOSURE = 0.6; // light adds up where dots crowd, as it does on a real surface
const vec3 PAPER = vec3(0.953, 0.933, 0.894);
const vec3 ONAIR = vec3(1.0, 0.541, 0.165);
const vec3 KEY = normalize(vec3(-0.62, 0.42, 0.66)); // the light on the figure, from high on the left

float isHot(float w) { return (w >= 5.0 && w < 6.0) || (w >= 7.0 && w < 8.0) ? 1.0 : 0.0; }
float isSurface(float w) { return w >= 8.0 && w < 9.0 ? uDust : 1.0; }
float isFine(float w) { return (w >= 8.0 && w < 9.0) || w >= 10.0 ? 1.0 : 0.0; }
bool isGlobe(float w) { return (w >= 2.0 && w < 3.0) || (w >= 5.0 && w < 6.0); }

float gLit; // how much light a point has, set by live()
float gGrow; // how much nearer a dot has come, set by live()
vec3 gFacing; // which way a dot on the relief faces, once turned

// A living photograph. I hold my shape: a small bob and the trailing leg's swing say walking, and the
// planted foot doesn't move. A quarter of the sand blows along the dunes; the rest holds the ripples.
vec3 inDesert(vec3 p, bool figure) {
  float t = uTime;
  float phase = aSeed * 6.2831;
  float twinkle = 0.5 + 0.5 * sin(t * (0.8 + aSeed * 1.6) + phase * 7.0);
  vec2 q = p.xy;
  float near = p.z;
  if (figure) {
    float stride = t * 3.4; // a step about every 1.8 seconds
    q.x += p.z * sin(stride) * 0.016;
    q.y += p.z * max(sin(stride), 0.0) * 0.01 + cos(stride * 2.0) * 0.0022 * smoothstep(uFeet, uFeet + 0.3, p.y);
    q += vec2(sin(t * 1.9 + phase * 5.0), cos(t * 1.6 + phase * 3.0)) * 0.0016;
    near = FIGURE_NEAR;
    gLit = mix(0.82, 1.12, twinkle);
  } else if (aSeed < 0.25 && p.z > 0.0) {
    float run = fract(t * (0.05 + aSeed * 0.3) + aSeed * 9.0);
    q.x += (run - 0.5) * 0.09 * (0.3 + near);
    q.y += sin(t * 0.9 + phase * 3.0) * 0.004;
    gLit = 1.4 * sin(run * 3.14159);
  } else {
    q.x += sin(t * 0.13 + phase) * 0.004;
    gLit = mix(0.55, 1.1, twinkle);
  }
  gLit *= 1.0 - smoothstep(aSeed * 0.8, aSeed * 0.8 + 0.2, uFade); // thins out into the white, never to fog
  gGrow = 1.0 + uWalk * 0.18;
  return vec3(pull(q, near), 0.0);
}

vec3 live(vec4 s) {
  float code = floor(s.w + 0.001);
  vec3 p = s.xyz;
  float phase = aSeed * 6.2831;
  gLit = 1.0;
  gGrow = 1.0;
  gFacing = vec3(0.0, 0.0, 1.0);
  if (code > 9.5) {
    return inDesert(p, code > 10.5);
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
    // Surface points drift along a local tangent instead of floating off the head.
    // Motion is independent of scroll and stays sub-pixel under normal framing.
    vec3 tangent = normalize(cross(aNormal, vec3(0.0, 1.0, 0.015)) + vec3(0.0001));
    p += tangent * sin(uTime * (0.52 + aSeed * 0.36) + phase * 7.0) * 1.25;
    gLit *= 0.76 + 0.24 * sin(uTime * (0.43 + aSeed * 0.19) + phase * 8.0);
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
  vAlpha *= mix(isSurface(aFrom.w), isSurface(aTo.w), k); // the sculpture's own dots, at their own level

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

const UNIFORMS = ['uMouse', 'uLean', 'uPan', 'uFocus', 'uAspect', 'uTime', 'uMorph', 'uSize', 'uLevel', 'uHigh', 'uGlobeX', 'uTurn', 'uZoom', 'uFly', 'uWalk', 'uFade', 'uFeet', 'uDust'];

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

  const buffers = new Map();
  let bound = [null, null];
  let bust = null;
  let dunes = null;

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
    setBust(sculpture) { bust = sculpture; },
    setDunes(layer) { dunes = layer; },
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(u.uAspect, innerWidth / innerHeight);
      gl.uniform1f(u.uSize, (innerWidth < 640 ? 1.35 : 1.7) * dpr);
    },
    draw({ from, to, morph, time, mouse, level = 0, high = 0, globeX = 0, turn = 0, lean = [0, 0], pan = [0, 0], zoom = 1, fly = 0, walk = 0, focus = [0, 0], body = 0, bustScale = 1, fade = 0, feet = 0, strands = 0, dust = 1 }) {
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const sculpted = bust && body > 0.002;
      if (sculpted) {
        bust.draw({ body, scale: bustScale, time, turn, zoom, lean, pan, mouse });
        seedAttribute.bind();
        normalAttribute.bind();
        bound = [null, null];
      } else {
        gl.disable(gl.DEPTH_TEST);
      }
      gl.depthMask(false);
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
      gl.uniform1f(u.uFade, fade);
      gl.uniform1f(u.uFeet, feet);
      gl.uniform1f(u.uDust, dust);
      gl.uniform1f(u.uTurn, turn);
      gl.uniform1f(u.uZoom, zoom);
      gl.uniform1f(u.uFly, fly);
      gl.uniform1f(u.uLevel, level);
      gl.uniform1f(u.uHigh, high);
      gl.uniform1f(u.uGlobeX, globeX);
      gl.drawArrays(gl.POINTS, 0, count);
      if (dunes && strands > 0.002) {
        dunes.draw({ time, show: strands, focus, walk });
        seedAttribute.bind();
        normalAttribute.bind();
        bound = [null, null];
      }
    },
    stop() {
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
  return scene;
}
