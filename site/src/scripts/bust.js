import { buildProgram, FIGURE_GLSL } from './scene.js';

// The hero's sculpture: a real closed mesh in charcoal, and a living skin of hairline strands that
// follow its surface. The scene's dots land on the same surface and are hidden by it, so what you see
// has a back to it. Kept apart from the particle scene: scene.js only asks it to draw.
const PIVOT_ROW = 826; // scripts/bake-bust.py: photo rows, about which the head's px are stored
const PHOTO_CENTRE = 711; // the column of the head's centre line in the photo

const LIT_GLSL = `
const vec3 KEY = normalize(vec3(-0.62, 0.42, 0.66));
// A soft, finite pool of light where the pointer is, a low key, and a rim so the back never vanishes.
float lit(vec3 n, vec3 p, vec2 pointer, out float pool) {
  vec3 toLight = vec3(pointer, 1.0) - p;
  float far = dot(toLight, toLight);
  pool = max(dot(n, normalize(toLight)), 0.0) / (1.0 + far * 2.4);
  float key = max(dot(n, KEY) * 0.6 + 0.4, 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 3.0);
  return key * key * 0.62 + rim * 0.3 + min(pool * 1.5, 0.75); // capped, so the nose never bleaches
}`;

// No cut edge: the chest thins out into nothing before the mesh ends.
const LOW_EDGE_GLSL = 'float lowEdge(float y) { return smoothstep(-690.0, -430.0, y); }';

const MESH_VERT = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aFacing;
uniform float uScale;
varying vec3 vFacing, vPlace, vSeed, vRaw;
${FIGURE_GLSL}
void main() {
  vSeed = aPosition;
  vRaw = aFacing;
  vFacing = turned(aFacing);
  vec3 p = placed(turned(aPosition * uScale), 0.55);
  vPlace = p;
  gl_Position = onScreen(p);
}`;

const MESH_FRAG = `
precision highp float;
uniform vec2 uMouse;
uniform float uBody, uShade;
uniform sampler2D uTone;
varying vec3 vFacing, vPlace, vSeed, vRaw;
${LIT_GLSL}
${LOW_EDGE_GLSL}
float grain(vec3 p) { return fract(sin(dot(floor(p / 1.7), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  if (grain(vSeed) > uBody) discard; // the sculpture gathers from and breaks back into dust
  vec3 n = normalize(vFacing);
  float pool;
  float light = lit(n, vPlace, uMouse, pool);
  vec3 toLight = normalize(vec3(uMouse, 1.0) - vPlace);
  float sheen = pow(max(dot(n, normalize(toLight + vec3(0.0, 0.0, 1.0))), 0.0), 24.0) * pool * 0.5;
  // Toned stone: dark hair, beard, brows and eyes from the front, thrown straight back along the head.
  float row = ${PIVOT_ROW.toFixed(1)} - vSeed.y;
  float toned = texture2D(uTone, vec2((vSeed.x + ${PHOTO_CENTRE.toFixed(1)}) / 1333.0, row / 2000.0)).r;
  // The tone photo only informs subtle relief, never acts as a projected facial texture.
  // Keep the full volume visible even outside the pointer pool.
  float stone = mix(0.60, 0.77 + toned * 0.12, smoothstep(0.05, 0.45, vRaw.z));
  vec3 graphite = vec3(0.38, 0.395, 0.42) * stone;
  vec3 ink = vec3(0.065, 0.068, 0.075);
  float fill = 0.32 + light * 1.06;
  gl_FragColor = vec4(mix(ink, mix(ink, graphite * fill + sheen * 0.32, uShade), lowEdge(vSeed.y)), 1.0);
}`;

const STRAND_VERT = `
precision highp float;
attribute vec3 aStart, aTangent, aNormal;
attribute vec4 aShape; // along the strand 0 to 1, length, bend, brightness
attribute float aPhase;
uniform float uScale, uBody;
varying float vAlpha;
${FIGURE_GLSL}
${LIT_GLSL}
${LOW_EDGE_GLSL}
void main() {
  float t = aShape.x;
  vec3 side = cross(aNormal, aTangent);
  // The surface breathes: neighbours swing together, slowly, a few degrees either way, never off the surface.
  float swing = sin(uTime * 0.31 + dot(aStart, vec3(0.011, 0.014, 0.009))) * 0.42 + sin(uTime * 0.53 + aPhase * 6.28) * 0.12;
  vec3 along = aTangent * cos(swing) + side * sin(swing);
  vec3 across = aTangent * -sin(swing) + side * cos(swing);
  float drift = sin(uTime * 0.4 + aPhase * 6.28) * 2.2; // creeping along the surface
  vec3 q = aStart + along * (aShape.y * t + drift) + across * aShape.z * aShape.y * t * t + aNormal * 1.6;
  vec3 facing = turned(aNormal);
  vec3 p = placed(turned(q * uScale), 0.55);
  float pool;
  float light = lit(facing, p, uMouse, pool);
  // Light catches a hair across its length, not along it.
  vec3 line = normalize(turned(along));
  float glint = 1.0 - abs(dot(line, normalize(vec3(uMouse, 1.0) - p)));
  float taper = sin(t * 3.14159);
  vAlpha = taper * aShape.w * (0.09 + light * 0.36 + pool * glint * glint * 0.7) * smoothstep(0.35, 1.0, uBody) * lowEdge(aStart.y);
  gl_Position = onScreen(p);
}`;

// Contour lines: where the sculpture crosses a stack of tilted planes, so a line can't leave the
// surface, and each wraps the nose, brow and cheek like a line on a map. Nothing moves but light,
// a slow bright passage running along each line at its own pace.
const CONTOUR_VERT = `
precision highp float;
attribute vec3 aPosition, aFacing;
attribute vec4 aMeta; // along the line, the line's own phase, brightness, pace
uniform float uScale, uBody;
varying float vAlpha;
${FIGURE_GLSL}
${LIT_GLSL}
${LOW_EDGE_GLSL}
void main() {
  vec3 facing = turned(aFacing);
  vec3 p = placed(turned((aPosition + aFacing * 1.3) * uScale), 0.55);
  float pool;
  float light = lit(facing, p, uMouse, pool);
  float along = fract(aMeta.x * 0.0021 - uTime * aMeta.w * 0.055 + aMeta.y);
  float passing = smoothstep(0.86, 0.985, along) * smoothstep(1.0, 0.985, along);
  float breath = 0.82 + 0.18 * sin(uTime * (0.3 + aMeta.y * 0.3) + aMeta.y * 40.0 + aMeta.x * 0.004);
  vAlpha = aMeta.z * (0.28 + light * 0.78 + pool * 0.62 + passing * 0.82) * breath * smoothstep(0.35, 1.0, uBody) * lowEdge(aPosition.y);
  gl_Position = onScreen(p);
}`;

const STRAND_FRAG = `
precision mediump float;
varying float vAlpha;
void main() { gl_FragColor = vec4(0.953, 0.933, 0.894, min(vAlpha, 1.0)); }`;

const RECORD = 16; // bytes per strand in strands.bin
const STRAND_FLOATS = 14;
const CONTOUR_FLOATS = 10;
const CONTOUR_STEP = 6.5; // px of height between lines in the hair
const TILT = [0.1, 0.74, 0.66]; // the planes lean back, so lines run round the head, not across it
// Per part of the head: which lines to keep, how bright, how fast the light runs. Quieter on the face.
const ZONES = {
  hair: { every: 2, bright: 0.34, pace: 1.1 },
  face: { every: 3, bright: 0.3, pace: 0.45 },
  neck: { every: 3, bright: 0.3, pace: 0.6 },
  body: { every: 5, bright: 0.28, pace: 0.5 },
};
// Left clear, or lines would tangle in the eyes and nostrils. Centre and radii in px about the pivot.
const CLEAR = [[-108, -71, 66, 28], [112, -78, 66, 28], [0, -200, 62, 22]];

// bust.bin and strands.bin, as written by scripts/bake-bust.py.
export function readBust(meshBuffer, strandBuffer, strandLimit) {
  const [vertexCount, indexCount] = new Uint32Array(meshBuffer, 0, 2);
  const positions = new Int16Array(meshBuffer, 8, vertexCount * 3);
  const facing = new Int8Array(meshBuffer, 8 + vertexCount * 6, vertexCount * 3);
  const indices = new Uint16Array(meshBuffer, 8 + vertexCount * 9 + ((vertexCount * 3) % 2), indexCount);
  const strandCount = Math.min(strandLimit, new Uint32Array(strandBuffer, 0, 1)[0]);
  return { positions, facing, indices, strands: new DataView(strandBuffer, 4), strandCount, contourShare: strandLimit < 20000 ? 0.6 : 1 };
}

// Three segments per strand, so it can bend. Unpacked here rather than shipped, which keeps the download small.
function strandVertices({ strands, strandCount }) {
  let hairStrands = 0;
  for (let i = 0; i < strandCount; i++) hairStrands += strands.getUint8(i * RECORD + 15); // the face is the contours' now
  const data = new Float32Array(hairStrands * 6 * STRAND_FLOATS);
  const ends = [0, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 1];
  let at = 0;
  for (let i = 0; i < strandCount; i++) {
    const o = i * RECORD;
    if (!strands.getUint8(o + 15)) continue;
    const phase = (i * 0.618034) % 1;
    for (const t of ends) {
      for (let c = 0; c < 3; c++) data[at++] = strands.getInt16(o + c * 2, true);
      for (let c = 0; c < 3; c++) data[at++] = strands.getInt8(o + 6 + c) / 127;
      for (let c = 0; c < 3; c++) data[at++] = strands.getInt8(o + 9 + c) / 127;
      data[at++] = t;
      data[at++] = strands.getUint8(o + 12);
      data[at++] = strands.getInt8(o + 13) / 127;
      data[at++] = strands.getUint8(o + 14) / 255;
      data[at++] = phase;
    }
  }
  return data;
}

const zoneOf = (x, y, z, nz) => {
  const row = PIVOT_ROW - y;
  if (row > 1300) return ZONES.body;
  if (row > 1262 || z < -60 && row > 830) return ZONES.neck;
  if (row < 790 && !(row > 640 && nz > 0.55 && z > 150)) return ZONES.hair;
  return ZONES.face;
};

// Walks every triangle once, so it costs a few milliseconds at load and nothing to download.
function contourVertices({ positions, facing, indices }, keep) {
  const count = positions.length / 3;
  const height = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const [x, y, z] = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    height[i] = x * TILT[0] + y * TILT[1] + z * TILT[2] + Math.sin(x * 0.009 + y * 0.004) * 9 + Math.sin(z * 0.011 - y * 0.006 + 2) * 7;
  }
  let out = new Float32Array(CONTOUR_FLOATS * 2 * 30000);
  let used = 0;
  const end = new Float32Array(12); // the two ends of the current segment: position and facing
  for (let f = 0; f < indices.length; f += 3) {
    const a = indices[f];
    const b = indices[f + 1];
    const c = indices[f + 2];
    const low = Math.min(height[a], height[b], height[c]);
    const high = Math.max(height[a], height[b], height[c]);
    for (let level = Math.ceil(low / CONTOUR_STEP); level <= Math.floor(high / CONTOUR_STEP); level++) {
      const iso = level * CONTOUR_STEP;
      let ends = 0;
      for (let edge = 0; edge < 3 && ends < 2; edge++) {
        const i = edge === 0 ? a : edge === 1 ? b : c;
        const j = edge === 0 ? b : edge === 1 ? c : a;
        if ((height[i] < iso) === (height[j] < iso)) continue;
        const t = (iso - height[i]) / (height[j] - height[i]);
        for (let axis = 0; axis < 3; axis++) {
          end[ends * 6 + axis] = positions[i * 3 + axis] + (positions[j * 3 + axis] - positions[i * 3 + axis]) * t;
          end[ends * 6 + 3 + axis] = (facing[i * 3 + axis] + (facing[j * 3 + axis] - facing[i * 3 + axis]) * t) / 127;
        }
        ends++;
      }
      if (ends !== 2) continue;
      const zone = zoneOf(end[0], end[1], end[2], end[5]);
      if (((level % zone.every) + zone.every) % zone.every !== 0 || (Math.abs(level) * 0.37) % 1 > keep) continue;
      if (end[5] > 0.2 && end[2] > 90 && CLEAR.some(([cx, cy, rx, ry]) => ((end[0] - cx) / rx) ** 2 + ((end[1] - cy) / ry) ** 2 < 1)) continue;
      if (used + CONTOUR_FLOATS * 2 > out.length) {
        const bigger = new Float32Array(out.length * 2);
        bigger.set(out);
        out = bigger;
      }
      const phase = (Math.abs(level) * 0.618034) % 1;
      for (let v = 0; v < 2; v++) {
        for (let n = 0; n < 6; n++) out[used++] = end[v * 6 + n];
        out[used++] = Math.atan2(end[v * 6], end[v * 6 + 2] + 40) * 260;
        out[used++] = phase;
        out[used++] = zone.bright;
        out[used++] = zone.pace;
      }
    }
  }
  return out.subarray(0, used);
}

// Dots on the same surface as the strands, so they can leave it for the next shape. The strands are
// already spread where the sculpture wants detail, so each dot starts beside one.
export function surfaceDot(data, i) {
  const o = (i % data.strandCount) * RECORD;
  const s = data.strands;
  const along = (Math.random() - 0.5) * 12;
  const offset = (axis) => s.getInt16(o + axis * 2, true) + (s.getInt8(o + 6 + axis) / 127) * along;
  return { x: offset(0), y: offset(1), z: offset(2), nx: s.getInt8(o + 9) / 127, ny: s.getInt8(o + 10) / 127, nz: s.getInt8(o + 11) / 127, lum: s.getUint8(o + 14) / 255 };
}

const NAMES = ['uScale', 'uAspect', 'uTime', 'uBody', 'uTurn', 'uZoom', 'uLean', 'uPan', 'uMouse', 'uShade', 'uTone'];

// layers: which of the sculpture's parts to draw, so each can be judged on its own.
export function createBust(gl, data, layers = { mesh: true, contours: true, strands: true }) {
  const meshProgram = buildProgram(gl, MESH_VERT, MESH_FRAG);
  const strandProgram = buildProgram(gl, STRAND_VERT, STRAND_FRAG);
  const contourProgram = buildProgram(gl, CONTOUR_VERT, STRAND_FRAG);
  const uniformsOf = (program) => Object.fromEntries(NAMES.map((name) => [name, gl.getUniformLocation(program, name)]));
  const meshU = uniformsOf(meshProgram);
  const strandU = uniformsOf(strandProgram);
  const contourU = uniformsOf(contourProgram);

  const buffer = (target, values) => {
    const b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, values, gl.STATIC_DRAW);
    return b;
  };
  const positions = buffer(gl.ARRAY_BUFFER, new Float32Array(data.positions));
  const facing = buffer(gl.ARRAY_BUFFER, Float32Array.from(data.facing, (v) => v / 127));
  const indices = buffer(gl.ELEMENT_ARRAY_BUFFER, data.indices);
  const strandData = strandVertices(data);
  const strands = buffer(gl.ARRAY_BUFFER, strandData);
  const strandVerts = strandData.length / STRAND_FLOATS;
  // Made in the first quiet moment, not during load. The sculpture is still forming from its dots by then.
  let contours = null;
  let contourVerts = 0;
  const buildContours = () => {
    const made = contourVertices(data, data.contourShare);
    contours = buffer(gl.ARRAY_BUFFER, made);
    contourVerts = made.length / CONTOUR_FLOATS;
  };
  if (window.requestIdleCallback) requestIdleCallback(buildContours, { timeout: 2000 });
  else setTimeout(buildContours, 300);

  const tone = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tone);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([100]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const toneImage = new Image();
  toneImage.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tone);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, toneImage);
  };
  toneImage.src = '/hero/bust-tone.webp';

  const attribute = (program, name, size, stride = 0, offset = 0) => {
    const loc = gl.getAttribLocation(program, name);
    if (loc < 0) return loc;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    return loc;
  };

  const setCommon = (u, frame) => {
    gl.uniform1f(u.uScale, frame.scale);
    gl.uniform1f(u.uAspect, innerWidth / innerHeight);
    gl.uniform1f(u.uTime, frame.time);
    gl.uniform1f(u.uBody, frame.body);
    gl.uniform1f(u.uTurn, frame.turn);
    gl.uniform1f(u.uZoom, frame.zoom);
    gl.uniform2f(u.uLean, frame.lean[0], frame.lean[1]);
    gl.uniform2f(u.uPan, frame.pan[0], frame.pan[1]);
    gl.uniform2f(u.uMouse, frame.mouse[0], frame.mouse[1]);
  };

  return {
    // Leaves depth testing on, so the scene's dots fall behind the sculpture too. Shares the
    // scene's attribute slots, so the scene re-binds its own afterwards.
    draw(frame) {
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(meshProgram);
      setCommon(meshU, frame);
      gl.uniform1f(meshU.uShade, layers.mesh ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tone);
      gl.uniform1i(meshU.uTone, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      attribute(meshProgram, 'aPosition', 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, facing);
      attribute(meshProgram, 'aFacing', 3);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
      gl.drawElements(gl.TRIANGLES, data.indices.length, gl.UNSIGNED_SHORT, 0);

      gl.enable(gl.BLEND);
      gl.depthMask(false);
      if (layers.contours && contours) {
        gl.useProgram(contourProgram);
        setCommon(contourU, frame);
        gl.bindBuffer(gl.ARRAY_BUFFER, contours);
        const bytes = CONTOUR_FLOATS * 4;
        attribute(contourProgram, 'aPosition', 3, bytes, 0);
        attribute(contourProgram, 'aFacing', 3, bytes, 12);
        attribute(contourProgram, 'aMeta', 4, bytes, 24);
        gl.drawArrays(gl.LINES, 0, contourVerts);
      }
      if (!layers.strands) return;
      gl.useProgram(strandProgram);
      setCommon(strandU, frame);
      gl.bindBuffer(gl.ARRAY_BUFFER, strands);
      const bytes = STRAND_FLOATS * 4;
      attribute(strandProgram, 'aStart', 3, bytes, 0);
      attribute(strandProgram, 'aTangent', 3, bytes, 12);
      attribute(strandProgram, 'aNormal', 3, bytes, 24);
      attribute(strandProgram, 'aShape', 4, bytes, 36);
      attribute(strandProgram, 'aPhase', 1, bytes, 52);
      gl.drawArrays(gl.LINES, 0, strandVerts);
    },
  };
}
