// Living Desert: a dark world drawn by light. Three real layers (dune plate, the figure from the
// photograph, its matte) sit at their own depths, so the camera's push-in has true parallax; flecks
// sampled from where sun catches the ripples, the horizon and my edges carry the image, as dust in
// light does in Elimar. Scroll only moves the camera; time alone drives the life, so nothing stops
// when the visitor does. This is layered 2.5D from one photograph, not a scan or a splat.
const URLS = ['/hero/desert-plate.webp', '/hero/desert-photo.webp', '/hero/desert-matte.webp'];
const FLECKS = { phone: 28000, desktop: 76000 };
const SAND = 0, FIGURE = 1, SKY = 2, AIR = 3;
const MIX = [0.78, 0.09, 0.05, 0.08]; // of the flecks, by the kinds above
const HORIZON = 0.575; // up the image, where sand meets sky
const SAMPLE_WIDTH = 1000;
const PUSH_ENDS = 0.96; // of the close's scroll: the camera keeps moving under the white until here

// One camera for picture and flecks, or the flecks would slide off what they sit on. Ground nearer
// the camera moves faster; the figure moves as the ground at its feet does.
const CAMERA_GLSL = `
uniform float uRatio, uImageRatio, uPush;
const vec2 PIVOT = vec2(0.512, 0.34);
const float HORIZON = ${HORIZON.toFixed(3)};
const float FAR = 0.2, NEAR = 0.62, FIGURE_ZOOM = 0.52;
float nearness(float v) { return clamp((HORIZON - v) / HORIZON, 0.0, 1.0); }
float groundZoom(float v) { float n = nearness(v); return 1.0 + uPush * (FAR + (NEAR - FAR) * n * sqrt(n)); }
vec2 toGround(vec2 q) { return PIVOT + (q - PIVOT) * groundZoom(q.y); }
vec2 toFigure(vec2 q) { return PIVOT + (q - PIVOT) * (1.0 + uPush * FIGURE_ZOOM); }
vec2 fromGround(vec2 s) { // the inverse has no closed form, but settles in a few steps
  vec2 q = s;
  for (int i = 0; i < 4; i++) q = PIVOT + (s - PIVOT) / groundZoom(q.y);
  return q;
}
vec2 fromFigure(vec2 s) { return PIVOT + (s - PIVOT) / (1.0 + uPush * FIGURE_ZOOM); }
vec2 viewSpan() { return vec2(min(uRatio / uImageRatio, 1.0), min(uImageRatio / uRatio, 1.0)); }
vec2 viewCentre() { vec2 span = viewSpan(); return vec2(0.512, clamp(0.47, span.y * 0.5, 1.0 - span.y * 0.5)); } // never past the image's edge`;

const PICTURE_VERT = `attribute vec2 aPosition;
varying vec2 vUV;
void main() { vUV = 0.5 * (aPosition + 1.0); gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const PICTURE_FRAG = `precision highp float;
varying vec2 vUV;
uniform sampler2D uPlate, uFigure, uMatte;
uniform float uTime;
uniform vec2 uMouse;
${CAMERA_GLSL}
float luma(vec3 c) { return dot(c, vec3(0.21, 0.72, 0.07)); }
void main() {
  vec2 s = viewCentre() + (vUV - 0.5) * viewSpan();
  vec2 g = fromGround(s), f = fromFigure(s);
  vec3 plate = texture2D(uPlate, g).rgb;
  float sky = smoothstep(HORIZON - 0.004, HORIZON + 0.012, g.y);
  float sand = luma(plate);
  // A low sun: the sand falls away to near black between its lit faces.
  float ground = pow(smoothstep(0.34, 0.74, sand), 1.7) * 0.34 + 0.012;
  float cloud = smoothstep(0.3, 0.72, plate.r);
  float air = 0.03 + (1.0 - g.y) * 0.05 + cloud * 0.13;
  float tone = mix(ground, air, sky);
  // A broad soft light wanders over the dunes.
  float sweep = 0.5 + 0.5 * sin(g.x * 4.0 + g.y * 7.0 - uTime * 0.16 + 1.6 * sin(g.x * 2.3 + uTime * 0.05));
  tone *= 0.82 + 0.34 * sweep * (1.0 - sky);
  float matte = texture2D(uMatte, f).r;
  float body = luma(texture2D(uFigure, f).rgb);
  tone = mix(tone, pow(body, 1.35) * 0.62 + 0.012, smoothstep(0.35, 0.65, matte));
  vec2 d = vUV - uMouse;
  tone += exp(-dot(d, d) * 6.0) * 0.03;
  tone *= 1.0 - 0.34 * dot(vUV - 0.5, vUV - 0.5) * 2.0;
  gl_FragColor = vec4(vec3(tone) * vec3(1.0, 0.985, 0.96), 1.0);
}`;

const FLECK_VERT = `precision highp float;
attribute vec4 aRest;   // u, v, light, kind
attribute vec4 aMotion; // three seeds, size
uniform float uTime, uSize;
varying float vAlpha;
${CAMERA_GLSL}
// Neighbours share this, so grains move as air moves and not as noise.
vec2 flow(vec2 q, float t) {
  return vec2(sin(q.y * 38.0 + t * 0.31 + 1.7 * sin(q.x * 9.0 - t * 0.17)),
              cos(q.x * 27.0 - t * 0.23 + 1.5 * sin(q.y * 14.0 + t * 0.13)));
}
void main() {
  float t = uTime, kind = aRest.w, light = aRest.z;
  float a = aMotion.x, b = aMotion.y, c = aMotion.z;
  vec2 q = aRest.xy;
  float near = nearness(q.y);
  float life = 1.0, sheds = 0.0;
  if (kind < 0.5 || (kind < 1.5 && q.y < 0.6)) { // the face and cap never shed
    q += flow(q, t) * (kind < 0.5 ? 0.0011 * (0.25 + near) : 0.0004);
    sheds = step(kind < 0.5 ? 0.9 : 0.93, a);
    if (sheds > 0.5) { // a grain lifts on the wind, travels a short way, and is back at its anchor
      float age = fract(t * (0.07 + 0.09 * b) + c * 7.0);
      q += vec2(1.0, 0.14) * age * (0.016 + 0.05 * near) + vec2(0.0, sin(age * 3.1416) * 0.012);
      life = sin(age * 3.1416);
    }
  } else if (kind > 2.5) { // air: a few motes low over the sand, nearer ones quicker
    float speed = 0.0028 + 0.009 * b;
    q.x = fract(q.x + t * speed);
    q.y += sin(t * 0.31 + c * 40.0) * 0.008 + flow(q, t).y * 0.004;
    life = smoothstep(0.0, 0.12, q.x) * smoothstep(1.0, 0.88, q.x) * (0.6 + 0.4 * sin(t * 0.5 + a * 30.0));
  } else {
    q += flow(q * 0.6, t * 0.6) * 0.0009;
  }
  vec2 s = kind > 0.5 && kind < 1.5 ? toFigure(q) : toGround(q);
  vec2 xy = (s - viewCentre()) / viewSpan() + 0.5;
  gl_Position = vec4(xy * 2.0 - 1.0, 0.0, 1.0);
  float glimmer = 0.62 + 0.38 * sin(t * (0.35 + 0.9 * b) + c * 44.0);
  float band = 0.5 + 0.5 * sin(q.x * 6.0 + q.y * 11.0 - t * 0.24 + 2.0 * sin(q.x * 3.0 + t * 0.07));
  band = kind > 0.5 ? 0.6 : band * band * band; // the passing light belongs to the sand
  gl_PointSize = uSize * aMotion.w * (0.75 + 1.2 * light) * (1.0 + near * (0.5 + uPush * 0.7));
  vAlpha = light * glimmer * (0.22 + 1.05 * band) * life * (kind > 0.5 && kind < 1.5 ? 0.8 : 1.0);
}`;

const FLECK_FRAG = `precision mediump float;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = dot(q, q);
  if (r > 0.25) discard;
  gl_FragColor = vec4(1.0, 0.985, 0.95, smoothstep(0.25, 0.03, r) * vAlpha);
}`;

function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image.decode().then(() => image);
}

function pixels(image, width, height, blur = 0) {
  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

// Importance sampling: flecks go where light actually falls, not evenly over the frame.
function sampleFlecks(plate, photo, matte, count) {
  const width = SAMPLE_WIDTH;
  const height = Math.round(width * plate.height / plate.width);
  const sand = pixels(plate, width, height);
  const soft = pixels(plate, width, height, 5);
  const body = pixels(photo, width, height);
  const cut = pixels(matte, width, height);
  const cutSoft = pixels(matte, width, height, 3);
  let state = 19875;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  const lum = (d, i) => (0.21 * d[i] + 0.72 * d[i + 1] + 0.07 * d[i + 2]) / 255;
  const values = new Float32Array(count * 8);
  let filled = 0;
  const add = (u, v, light, kind) => {
    const o = filled++ * 8;
    values.set([u, v, light, kind, random(), random(), random(), 0.8 + random() * 0.8], o);
  };
  const quota = MIX.map((share) => Math.round(share * count));
  const limit = count * 60;
  for (let kind = 0; kind < 4; kind++) {
    for (let made = 0, tries = 0; made < quota[kind] && tries < limit; tries++) {
      const u = random(), v = random();
      const x = Math.min(width - 1, Math.floor(u * width));
      const y = Math.min(height - 1, Math.floor((1 - v) * height));
      const i = (y * width + x) * 4;
      const onFigure = cut[i] > 128;
      let light = 0;
      if (kind === SAND && v < HORIZON + 0.002 && !onFigure) {
        const crest = Math.max(0, lum(sand, i) - lum(soft, i)) * 12;
        const edge = Math.abs(v - HORIZON) < 0.007 ? 0.14 : 0;
        light = Math.min(1, crest * crest + edge + lum(sand, i) * 0.16);
      } else if (kind === FIGURE && onFigure) {
        const rim = (1 - Math.abs(cutSoft[i] / 255 - 0.5) * 2) * 0.8;
        const shade = lum(body, i);
        light = Math.min(1, shade * shade * 0.55 + rim * 0.7);
      } else if (kind === SKY && v > HORIZON) {
        light = Math.max(0, sand[i] / 255 - 0.42) * 1.3;
      } else if (kind === AIR) {
        light = v < HORIZON && v > 0.04 ? 0.5 : 0;
      }
      if (random() > light) continue;
      add(u, v, Math.max(0.16, light), kind);
      made++;
    }
  }
  return { values, points: filled };
}

export async function startLivingDesert(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  let images;
  try { images = await Promise.all(URLS.map(loadImage)); } catch { return null; }
  const [plate, photo, matte] = images;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = (vert, frag, names) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return { p, u: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(p, name)])) };
  };
  const picture = program(PICTURE_VERT, PICTURE_FRAG, ['uPlate', 'uFigure', 'uMatte', 'uRatio', 'uImageRatio', 'uPush', 'uTime', 'uMouse']);
  const fleck = program(FLECK_VERT, FLECK_FRAG, ['uRatio', 'uImageRatio', 'uPush', 'uTime', 'uSize']);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  images.forEach((image, unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  });

  const count = matchMedia('(max-width: 700px)').matches ? FLECKS.phone : FLECKS.desktop;
  const { values, points } = sampleFlecks(plate, photo, matte, count);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, values.subarray(0, points * 8), gl.STATIC_DRAW);

  let mouse = [0.52, 0.48];
  const onMove = (event) => {
    const box = canvas.getBoundingClientRect();
    mouse = [(event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height];
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  const positionAt = gl.getAttribLocation(picture.p, 'aPosition');
  const restAt = gl.getAttribLocation(fleck.p, 'aRest');
  const motionAt = gl.getAttribLocation(fleck.p, 'aMotion');
  const imageRatio = plate.width / plate.height;
  let destroyed = false;

  const draw = (progress, time) => {
    if (destroyed) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height);
    }
    const ramp = Math.min(1, Math.max(0, progress / PUSH_ENDS));
    const push = ramp * (1.3 - 0.3 * ramp); // moves from the first scroll, settling a little at the end
    const ratio = width / height;
    gl.disable(gl.BLEND);
    gl.useProgram(picture.p);
    gl.uniform1f(picture.u.uRatio, ratio);
    gl.uniform1f(picture.u.uImageRatio, imageRatio);
    gl.uniform1f(picture.u.uPush, push);
    gl.uniform1f(picture.u.uTime, time);
    gl.uniform2f(picture.u.uMouse, mouse[0], mouse[1]);
    gl.uniform1i(picture.u.uPlate, 0);
    gl.uniform1i(picture.u.uFigure, 1);
    gl.uniform1i(picture.u.uMatte, 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(positionAt);
    gl.vertexAttribPointer(positionAt, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(positionAt);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(fleck.p);
    gl.uniform1f(fleck.u.uRatio, ratio);
    gl.uniform1f(fleck.u.uImageRatio, imageRatio);
    gl.uniform1f(fleck.u.uPush, push);
    gl.uniform1f(fleck.u.uTime, time);
    gl.uniform1f(fleck.u.uSize, Math.max(1.1, 1.5 * dpr));
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(restAt);
    gl.enableVertexAttribArray(motionAt);
    gl.vertexAttribPointer(restAt, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(motionAt, 4, gl.FLOAT, false, 32, 16);
    gl.drawArrays(gl.POINTS, 0, points);
  };
  return {
    points,
    draw,
    destroy() {
      destroyed = true;
      window.removeEventListener('pointermove', onMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
