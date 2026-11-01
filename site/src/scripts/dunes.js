import { buildProgram, PULL_GLSL } from './scene.js';

// The desert's fine layer: hairlines along the folds of my clothes and the contours of the ripples.
// They stay anchored to what they sit on and only breathe, so the figure never dissolves.
const VERT = `
precision highp float;
attribute vec3 aPlace;
attribute vec2 aDirection;
attribute vec4 aMeta; // along 0 to 1, length in scene units, brightness, 1 on me
uniform float uAspect, uTime, uShow;
${PULL_GLSL}
varying float vAlpha;
void main() {
  float phase = aPlace.x * 91.0 + aPlace.y * 57.0;
  float breathe = sin(uTime * 0.5 + phase) * 0.28;
  vec2 along = vec2(aDirection.x * cos(breathe) - aDirection.y * sin(breathe), aDirection.x * sin(breathe) + aDirection.y * cos(breathe));
  vec2 q = aPlace.xy + along * aMeta.y * (aMeta.x - 0.5);
  float near = aMeta.w > 0.5 ? FIGURE_NEAR : aPlace.z;
  gl_Position = vec4(pull(q, near) / vec2(uAspect, 1.0), 0.0, 1.0);
  vAlpha = aMeta.z * uShow * (0.6 + 0.4 * sin(uTime * 0.7 + phase * 3.0)) * (aMeta.w > 0.5 ? 0.62 : 0.34) * sin(aMeta.x * 3.14159);
}`;

const FRAG = `
precision mediump float;
varying float vAlpha;
void main() { gl_FragColor = vec4(0.953, 0.933, 0.894, vAlpha); }`;

const FLOATS = 9;
const RECORD = 12;

// frame: the scene's rectangle in scene units; px: photo px to scene units.
export function createDunes(gl, buffer) {
  const program = buildProgram(gl, VERT, FRAG);
  const u = Object.fromEntries(['uAspect', 'uTime', 'uShow', 'uFocus', 'uWalk'].map((name) => [name, gl.getUniformLocation(program, name)]));
  const source = new DataView(buffer);
  const count = buffer.byteLength / RECORD;
  const vertices = gl.createBuffer();

  const attribute = (name, size, offset) => {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, FLOATS * 4, offset);
  };

  return {
    place(frame, photoWidth) {
      const data = new Float32Array(count * 2 * FLOATS);
      const px = frame.w / photoWidth;
      let at = 0;
      for (let i = 0; i < count; i++) {
        const o = i * RECORD;
        const x = (source.getUint16(o, true) / 65535) * 4 - 1.5;
        const y = (source.getUint16(o + 2, true) / 65535) * 3;
        const z = (source.getUint16(o + 4, true) / 65535) * 3;
        const dx = source.getInt8(o + 6) / 127;
        const dy = source.getInt8(o + 7) / 127;
        const length = source.getUint8(o + 8) * px;
        for (const end of [0, 1]) {
          data.set([(x - 0.5) * frame.w + frame.x, (0.5 - y) * frame.h, z, dx, -dy, end, length, source.getUint8(o + 9) / 255, source.getUint8(o + 10)], at);
          at += FLOATS;
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    },
    draw({ time, show, focus, walk }) {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      attribute('aPlace', 3, 0);
      attribute('aDirection', 2, 12);
      attribute('aMeta', 4, 20);
      gl.uniform1f(u.uAspect, innerWidth / innerHeight);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uShow, show);
      gl.uniform1f(u.uWalk, walk);
      gl.uniform2f(u.uFocus, focus[0], focus[1]);
      gl.drawArrays(gl.LINES, 0, count * 2);
    },
  };
}
