// Living Desert: the source photograph remains readable while continuous-time GPU grain
// traces real subject and dune surfaces. Scroll only drives the camera; time drives motion.
// No splat/photogrammetry claims: this is an art-directed layered WebGL scene.
export async function startLivingDesert(canvas, imageURL = '/hero/desert-photo.png') {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  const image = new Image();
  image.decoding = 'async';
  image.src = imageURL;
  try { await image.decode(); } catch { return null; }

  const vertex = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = (vert, frag) => {
    const p = gl.createProgram();
    gl.attachShader(p, vertex(gl.VERTEX_SHADER, vert));
    gl.attachShader(p, vertex(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };

  const photoV = \`attribute vec2 aPosition;
  varying vec2 vUV;
  void main() { vUV = 0.5 * (aPosition + 1.0); gl_Position = vec4(aPosition, 0.0, 1.0); }\`;
  const photoF = \`precision mediump float;
  varying vec2 vUV;
  uniform sampler2D uImage;
  uniform float uRatio, uImageRatio, uPush, uTime;
  uniform vec2 uMouse;
  void main() {
    vec2 uv = vUV - 0.5;
    uv *= vec2(max(uRatio / uImageRatio, 1.0), max(uImageRatio / uRatio, 1.0));
    uv = vec2(0.5) + uv / (1.0 + uPush * 0.60);
    vec3 rgb = texture2D(uImage, uv).rgb;
    float gray = pow(dot(rgb, vec3(0.21, 0.72, 0.07)), 0.92);
    float sky = smoothstep(0.36, 0.49, uv.y);
    vec3 graphite = mix(vec3(gray * 0.46), vec3(gray * 0.25), sky);
    vec2 d = vUV - uMouse;
    graphite += exp(-dot(d, d) * 7.0) * 0.07;
    graphite *= 1.0 - 0.22 * length((vUV - 0.5) * 1.3);
    graphite += 0.005 * sin(vUV.y * 900.0 + vUV.x * 70.0 + uTime * 0.18);
    gl_FragColor = vec4(graphite, 1.0);
  }\`;

  const dustV = \`precision highp float;
  attribute vec4 aData;
  attribute vec4 aMotion;
  uniform float uTime, uPush, uRatio, uImageRatio, uSize;
  varying float vAlpha, vCold;
  void main() {
    float t = uTime;
    vec2 uv = aData.xy;
    float phase = aMotion.x * 6.2831853;
    float depth = aData.z;
    float airborne = step(0.64, aMotion.y);
    vec2 wind = vec2(0.00024, 0.00004) * t * (0.4 + depth * 0.6);
    vec2 curl = vec2(sin(uv.y * 32.0 + t * 0.35 + phase * 0.8),
                     cos(uv.x * 23.0 - t * 0.26 + phase * 0.6));
    vec2 eddy = vec2(cos(uv.y * 77.0 + t * 0.61 + phase),
                     sin(uv.x * 46.0 - t * 0.48 + phase));
    vec2 drift = (curl * 0.0016 + eddy * 0.0008) * (0.22 + 0.8 * depth);
    vec2 freeMotion = vec2(fract(uv.x + wind.x + aMotion.z * 0.17) - uv.x,
                          sin(t * 0.64 + phase) * 0.0034 +
                          cos(t * 0.18 + aMotion.z * 12.0) * 0.0019);
    uv += mix(drift, freeMotion, airborne);
    float cover = max(uRatio / uImageRatio, 1.0);
    float coverY = max(uImageRatio / uRatio, 1.0);
    vec2 focus = vec2(0.512, 0.47);
    vec2 xy = (uv - focus) * vec2(1.0 / cover, 1.0 / coverY) *
              (1.0 + uPush * 0.60 * (0.72 + depth * 0.33)) + focus;
    gl_Position = vec4(xy * 2.0 - 1.0, 0.0, 1.0);
    gl_PointSize = uSize * (0.62 + 0.6 * aMotion.w) * (1.0 + uPush * 0.18);
    float shimmer = 0.72 + 0.28 * sin(t * (0.31 + 0.2 * aMotion.z) + phase);
    float ridge = 0.45 + 0.55 * aData.w;
    vAlpha = (0.06 + 0.17 * ridge) * shimmer * (1.0 - airborne * 0.52);
    vCold = aMotion.y;
  }\`;
  const dustF = \`precision mediump float;
  varying float vAlpha, vCold;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = dot(q, q);
    if (r > 0.25) discard;
    float alpha = smoothstep(0.25, 0.006, r) * vAlpha;
    vec3 color = mix(vec3(0.87, 0.89, 0.91), vec3(0.96, 0.97, 1.0), vCold);
    gl_FragColor = vec4(color, alpha);
  }\`;
  const pictureProgram = program(photoV, photoF);
  const dustProgram = program(dustV, dustF);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // Importance sample the real image rather than scattering an even starfield.
  const work = document.createElement('canvas');
  work.width = 900;
  work.height = Math.round(900 * image.height / image.width);
  const ctx = work.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, work.width, work.height);
  const pixels = ctx.getImageData(0, 0, work.width, work.height).data;
  let state = 19875;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  const count = matchMedia('(max-width: 700px)').matches ? 24000 : 66000;
  const values = new Float32Array(count * 8);
  let points = 0, attempts = 0;
  while (points < count && attempts++ < count * 14) {
    const u = random(), v = random();
    const x = Math.min(work.width - 2, Math.floor(u * (work.width - 2)));
    const y = Math.min(work.height - 2, Math.floor((1 - v) * (work.height - 2)));
    const i = (y * work.width + x) * 4;
    const lum = (0.21 * pixels[i] + 0.72 * pixels[i + 1] + 0.07 * pixels[i + 2]) / 255;
    const ground = v < 0.63;
    const person = u > 0.438 && u < 0.57 && v > 0.085 && v < 0.72 && lum < 0.52;
    if (random() > (person ? 1 : ground ? 0.62 : 0.02)) continue;
    const o = points * 8;
    values[o] = u;
    values[o + 1] = v;
    values[o + 2] = person ? 0.96 : ground ? 0.12 + 0.66 * (0.64 - v) : 0.02;
    values[o + 3] = 0.2 + 0.8 * (1 - lum);
    values[o + 4] = random();
    values[o + 5] = random();
    values[o + 6] = random();
    values[o + 7] = 0.8 + random() * 0.8;
    points++;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, values.subarray(0, points * 8), gl.STATIC_DRAW);

  let mouse = [0.52, 0.48];
  const onMove = (event) => {
    const box = canvas.getBoundingClientRect();
    mouse = [(event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height];
  };
  canvas.addEventListener('pointermove', onMove);
  let destroyed = false;
  const draw = (progress, time) => {
    if (destroyed) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height);
    }
    const push = Math.min(1, Math.max(0, (progress - 0.12) / 0.66));
    const ratio = width / height;
    const imgRatio = image.width / image.height;
    gl.disable(gl.BLEND);
    gl.clearColor(0.03, 0.03, 0.035, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pictureProgram);
    const pu = (name) => gl.getUniformLocation(pictureProgram, name);
    gl.uniform1f(pu('uRatio'), ratio);
    gl.uniform1f(pu('uImageRatio'), imgRatio);
    gl.uniform1f(pu('uPush'), push);
    gl.uniform1f(pu('uTime'), time);
    gl.uniform2f(pu('uMouse'), mouse[0], mouse[1]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(pu('uImage'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const pos = gl.getAttribLocation(pictureProgram, 'aPosition');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(pos);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(dustProgram);
    const du = (name) => gl.getUniformLocation(dustProgram, name);
    gl.uniform1f(du('uRatio'), ratio);
    gl.uniform1f(du('uImageRatio'), imgRatio);
    gl.uniform1f(du('uPush'), push);
    gl.uniform1f(du('uTime'), time);
    gl.uniform1f(du('uSize'), Math.max(1.0, 1.4 * dpr));
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, offset] of [['aData', 0], ['aMotion', 16]]) {
      const at = gl.getAttribLocation(dustProgram, name);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 4, gl.FLOAT, false, 32, offset);
    }
    gl.drawArrays(gl.POINTS, 0, points);
  };
  return {
    points,
    draw,
    destroy() {
      destroyed = true;
      canvas.removeEventListener('pointermove', onMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
