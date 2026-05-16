// WebGL2 renderer for floating screen cards in perspective, with soft shadows and rounded corners.
const VERT = `#version 300 es
in vec2 a_uv;
uniform mat4 u_mvp;
uniform vec2 u_size;
uniform float u_grow;
out vec2 v_local;
void main() {
  vec2 local = (a_uv - 0.5) * (u_size + vec2(u_grow * 2.0));
  v_local = local;
  gl_Position = u_mvp * vec4(local.x, -local.y, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_local;
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform float u_radius;
uniform float u_alpha;
uniform float u_shadow;
uniform float u_blur;
uniform float u_bright;
out vec4 color;
float sdRound(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + vec2(r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 halfSize = u_size * 0.5;
  float d = sdRound(v_local, halfSize, u_radius);
  if (u_shadow > 0.5) {
    float a = 1.0 - smoothstep(-u_blur * 0.6, u_blur, d);
    color = vec4(0.0, 0.0, 0.0, a * 0.55 * u_alpha);
    return;
  }
  float aa = fwidth(d);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  vec2 uv = v_local / u_size + 0.5;
  vec3 rgb = texture(u_tex, uv).rgb * u_bright;
  float edge = 1.0 - smoothstep(0.0, 1.6 * aa + 0.8, abs(d + 0.8));
  rgb = mix(rgb, vec3(0.62, 0.70, 0.84), edge * 0.35);
  float gloss = smoothstep(0.0, 1.0, 1.0 - uv.y) * 0.05;
  rgb += gloss;
  float a = inside * u_alpha;
  color = vec4(rgb * a, a);
}`;

export function createCardRenderer(width, height) {
  const canvas = new OffscreenCanvas(width, height);
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: true, preserveDrawingBuffer: true });
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const loc = name => gl.getUniformLocation(prog, name);
  const U = { mvp: loc('u_mvp'), size: loc('u_size'), grow: loc('u_grow'), tex: loc('u_tex'), radius: loc('u_radius'), alpha: loc('u_alpha'), shadow: loc('u_shadow'), blur: loc('u_blur'), bright: loc('u_bright') };
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const aUv = gl.getAttribLocation(prog, 'a_uv');
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

  const textures = new Map();
  function addTexture(name, source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    textures.set(name, tex);
  }

  // cards: [{ texture, matrix (model, column-major Float32Array), w, h, radius, alpha, bright }]
  function render(camera, cards) {
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const viewProj = mul(camera.projection, camera.view);
    const sorted = cards
      .map(card => ({ card, depth: depthOf(camera.view, card.matrix) }))
      .sort((a, b) => a.depth - b.depth);
    for (const { card } of sorted) {
      const mvp = mul(viewProj, card.matrix);
      gl.uniformMatrix4fv(U.mvp, false, mvp);
      gl.uniform2f(U.size, card.w, card.h);
      gl.uniform1f(U.radius, card.radius ?? 18);
      gl.uniform1f(U.alpha, card.alpha ?? 1);
      gl.uniform1f(U.bright, card.bright ?? 1);
      // Soft shadow first, grown beyond the card, then the card itself.
      gl.uniform1f(U.shadow, 1);
      gl.uniform1f(U.blur, card.shadowBlur ?? 60);
      gl.uniform1f(U.grow, (card.shadowBlur ?? 60) * 1.2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.uniform1f(U.shadow, 0);
      gl.uniform1f(U.grow, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures.get(card.texture));
      gl.uniform1i(U.tex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return canvas;
  }
  return { canvas, addTexture, render };
}

function depthOf(view, model) {
  // Camera-space z of the card centre; more negative is further away.
  const x = model[12], y = model[13], z = model[14];
  return view[2] * x + view[6] * y + view[10] * z + view[14];
}

export function mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

export function lookAt(eye, target, up = [0, 1, 0]) {
  const z = norm(sub(eye, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

export function model({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 }) {
  // Translate * Rz * Ry * Rx * Scale, angles in radians; y is up in world space.
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const m = [
    cz * cy, sz * cy, -sy, 0,
    cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx, 0,
    cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx, 0,
    x, y, z, 1,
  ];
  for (let i = 0; i < 12; i++) if (i % 4 !== 3) m[i] *= s;
  return new Float32Array(m);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
