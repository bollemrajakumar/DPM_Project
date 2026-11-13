/**
 * WebGL2 compositor:
 *   pass 1  camera frame (full screen)
 *   pass 2  deformed garment mesh, lit by the camera's local luminance (folds/lighting)
 *   pass 3  occluders: camera pixels that must stay in front of the garment
 *           (hair + face-skin everywhere, body-skin only inside hand/forearm capsules)
 */
import type { CategoryMask } from "../lib/types";
import { SLEEVE_FROM, TORSO_UNTIL, type GarmentMesh } from "./garmentMesh";

const VS_QUAD = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS_VIDEO = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uVideo;
out vec4 o;
void main() { o = vec4(texture(uVideo, vUV).rgb, 1.0); }`;

const VS_MESH = `#version 300 es
in vec2 aPos;
in vec2 aUV;
in float aFade;
in float aLayer;
uniform vec2 uRes;
out vec2 vUV;
out vec2 vScreen;
out float vFade;
out float vLayer;
void main() {
  vUV = aUV;
  vFade = aFade;
  vLayer = aLayer;
  vScreen = aPos / uRes;
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS_MESH = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec2 vScreen;
in float vFade;
in float vLayer;
uniform sampler2D uGarment;
uniform sampler2D uParts;   // sleeve weights: r = left sleeve, g = right sleeve
uniform sampler2D uVideo;
uniform sampler2D uCat;
uniform float uHasCat;
uniform float uOpacity;
uniform float uFolds;     // transfer of local (high-pass) shading from the camera
uniform float uLighting;  // transfer of overall scene brightness
uniform float uVideoLod;
uniform float uFineLod;
out vec4 o;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec4 g = texture(uGarment, vUV);            // premultiplied alpha
  // Each mesh layer draws only its own part of the garment (see GarmentMesh).
  vec2 s = texture(uParts, vUV).rg;
  float own = vLayer < 0.5 ? 1.0 - smoothstep(0.5, ${TORSO_UNTIL.toFixed(3)}, max(s.r, s.g))
                           : smoothstep(${SLEEVE_FROM.toFixed(3)}, 0.5, vLayer < 1.5 ? s.r : s.g);
  if (own <= 0.0) discard;
  // Band-pass: medium-scale shading (body folds, shadows) without the fine detail of the
  // user's own clothing (checks, stripes, prints), which would otherwise show through.
  float l = lum(textureLod(uVideo, vScreen, uFineLod).rgb);
  float lBlur = lum(textureLod(uVideo, vScreen, uVideoLod).rgb);
  float folds = clamp(l / max(lBlur, 0.04), 0.72, 1.25);
  // Only borrow shading from the user's own clothes; silhouette edges against the
  // background would otherwise print light/dark bands onto the garment.
  float cls = floor(texture(uCat, vScreen).r * 255.0 + 0.5);
  float onClothes = mix(0.5, cls == 4.0 ? 1.0 : 0.0, uHasCat);
  folds = mix(1.0, folds, onClothes);
  float light = clamp(lBlur / 0.45, 0.45, 1.3);
  float shade = mix(1.0, folds, uFolds) * mix(1.0, light, uLighting);
  o = vec4(g.rgb * shade, g.a) * uOpacity * vFade * own;
}`;

const FS_OCCLUDE = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uVideo;
uniform sampler2D uCat;      // R8 category ids
uniform sampler2D uCaps;     // capsule mask (r)
uniform vec2 uCatTexel;
uniform float uHairFace;
out vec4 o;
float occ(vec2 uv) {
  float c = floor(texture(uCat, uv).r * 255.0 + 0.5);
  float hf = (c == 1.0 || c == 3.0) ? uHairFace : 0.0;
  float skin = (c == 2.0) ? texture(uCaps, uv).r : 0.0;
  return max(hf, skin);
}
void main() {
  vec2 t = uCatTexel;
  float a = occ(vUV) * 0.4
    + (occ(vUV + vec2(t.x, 0.0)) + occ(vUV - vec2(t.x, 0.0)) + occ(vUV + vec2(0.0, t.y)) + occ(vUV - vec2(0.0, t.y))) * 0.15;
  if (a <= 0.001) discard;
  o = vec4(texture(uVideo, vUV).rgb * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  if (gl.isContextLost()) throw new Error("WebGL context was lost — your GPU may be busy or the driver crashed. Try closing other tabs or reloading the page.");
  const s = gl.createShader(type);
  if (!s) throw new Error("Could not create a WebGL shader — your GPU may be out of resources. Try closing other browser tabs or applications using the GPU, then reload.");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? "(no details from driver)";
    gl.deleteShader(s);
    throw new Error(`Shader compilation failed: ${log}`);
  }
  return s;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error("Could not create a WebGL program — try reloading the page.");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.bindAttribLocation(p, 1, "aUV");
  gl.bindAttribLocation(p, 2, "aFade");
  gl.bindAttribLocation(p, 3, "aLayer");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? "(no details from driver)";
    gl.deleteProgram(p);
    throw new Error(`Shader program linking failed: ${log}`);
  }
  return p;
}

export interface RenderParams {
  opacity: number;
  folds: number;
  lighting: number;
  occlusion: boolean;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private pVideo: WebGLProgram;
  private pMesh: WebGLProgram;
  private pOcc: WebGLProgram;
  private quadVao: WebGLVertexArrayObject;
  private meshVao: WebGLVertexArrayObject;
  private posBuf: WebGLBuffer;
  private uvBuf: WebGLBuffer;
  private fadeBuf: WebGLBuffer;
  private layerBuf: WebGLBuffer;
  private indexCount = 0;
  private texVideo: WebGLTexture;
  private texGarment: WebGLTexture | null = null;
  private texParts: WebGLTexture;
  private texCat: WebGLTexture;
  private texCaps: WebGLTexture;
  private catSize = { w: 1, h: 1 };
  private hasCat = false;
  private width = 0;
  private height = 0;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  private _contextLost = false;

  get contextLost(): boolean {
    return this._contextLost;
  }

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this._contextLost = true;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this._contextLost = false;
    });
    let gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: false, antialias: true, preserveDrawingBuffer: true });
    if (!gl) {
      gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: false });
    }
    if (!gl) throw new Error("WebGL2 is not available in this browser. Use a current Chrome/Edge/Chromium.");
    this.gl = gl;
    this.pVideo = program(gl, VS_QUAD, FS_VIDEO);
    this.pMesh = program(gl, VS_MESH, FS_MESH);
    this.pOcc = program(gl, VS_QUAD, FS_OCCLUDE);

    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.meshVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.meshVao);
    this.posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    this.fadeBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    this.layerBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.layerBuf);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.texVideo = this.makeTex(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    this.texParts = this.makeTex(gl.LINEAR, gl.LINEAR);
    this.texCat = this.makeTex(gl.NEAREST, gl.NEAREST);
    this.texCaps = this.makeTex(gl.LINEAR, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  private makeTex(minF: number, magF: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minF);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magF);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return t;
  }

  private u(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.uniforms.get(p);
    if (!m) this.uniforms.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  resize(w: number, h: number): void {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  setGarment(image: TexImageSource, mesh: Pick<GarmentMesh, "triUVs" | "triLayers" | "parts">): void {
    const gl = this.gl;
    const uvs = mesh.triUVs;
    gl.bindTexture(gl.TEXTURE_2D, this.texParts);
    const { width, height, data } = mesh.parts;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, width, height, 0, gl.RG, gl.UNSIGNED_BYTE, data);
    if (this.texGarment) gl.deleteTexture(this.texGarment);
    this.texGarment = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texGarment);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension("EXT_texture_filter_anisotropic");
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);

    gl.bindVertexArray(this.meshVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs.length * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, (uvs.length / 2) * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.layerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.triLayers, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.indexCount = uvs.length / 2;
  }

  clearGarment(): void {
    this.indexCount = 0;
  }

  setCategoryMask(m: CategoryMask | null): void {
    const gl = this.gl;
    this.hasCat = !!m;
    if (!m) return;
    gl.bindTexture(gl.TEXTURE_2D, this.texCat);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, m.width, m.height, 0, gl.RED, gl.UNSIGNED_BYTE, m.data);
    this.catSize = { w: m.width, h: m.height };
  }

  setCapsules(c: HTMLCanvasElement | OffscreenCanvas): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texCaps);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c as TexImageSource);
  }

  render(frame: TexImageSource, positions: Float32Array | null, p: RenderParams, fade: Float32Array | null = null): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texVideo);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.useProgram(this.pVideo);
    gl.uniform1i(this.u(this.pVideo, "uVideo"), 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (positions && this.texGarment && this.indexCount > 0 && p.opacity > 0.003) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.pMesh);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texGarment);
      gl.uniform1i(this.u(this.pMesh, "uGarment"), 1);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.texParts);
      gl.uniform1i(this.u(this.pMesh, "uParts"), 4);
      gl.uniform1i(this.u(this.pMesh, "uVideo"), 0);
      gl.uniform2f(this.u(this.pMesh, "uRes"), this.width, this.height);
      gl.uniform1f(this.u(this.pMesh, "uOpacity"), p.opacity);
      gl.uniform1f(this.u(this.pMesh, "uFolds"), p.folds);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.texCat);
      gl.uniform1i(this.u(this.pMesh, "uCat"), 2);
      gl.uniform1f(this.u(this.pMesh, "uHasCat"), this.hasCat ? 1 : 0);
      gl.uniform1f(this.u(this.pMesh, "uLighting"), p.lighting);
      gl.uniform1f(this.u(this.pMesh, "uVideoLod"), Math.log2(Math.max(this.width, this.height) / 24));
      gl.uniform1f(this.u(this.pMesh, "uFineLod"), Math.max(0, Math.log2(Math.max(this.width, this.height) / 50)));
      gl.bindVertexArray(this.meshVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      if (fade) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fade);
      }
      gl.drawArrays(gl.TRIANGLES, 0, this.indexCount);

      if (p.occlusion && this.hasCat) {
        gl.useProgram(this.pOcc);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.texCat);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.texCaps);
        gl.uniform1i(this.u(this.pOcc, "uVideo"), 0);
        gl.uniform1i(this.u(this.pOcc, "uCat"), 2);
        gl.uniform1i(this.u(this.pOcc, "uCaps"), 3);
        gl.uniform2f(this.u(this.pOcc, "uCatTexel"), 1 / this.catSize.w, 1 / this.catSize.h);
        gl.uniform1f(this.u(this.pOcc, "uHairFace"), 1);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of [this.texVideo, this.texGarment, this.texCat, this.texCaps, this.texParts]) if (t) gl.deleteTexture(t);
    for (const b of [this.posBuf, this.uvBuf, this.fadeBuf, this.layerBuf]) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.quadVao);
    gl.deleteVertexArray(this.meshVao);
    for (const p of [this.pVideo, this.pMesh, this.pOcc]) gl.deleteProgram(p);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
