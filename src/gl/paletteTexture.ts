import { rasterizeGradient } from '../utils/color';

export const PALETTE_SIZE = 256;

/**
 * Uploads a cyclic gradient as a 256×1 SRGB8_ALPHA8 texture. The sRGB internal
 * format makes the GPU decode to linear light on sample, so the shader and
 * the accumulation buffer work in physically linear colour for free.
 */
export class PaletteTexture {
  readonly texture: WebGLTexture;
  private key = '';

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Re-uploads only when the stops actually changed. */
  update(stops: readonly string[]): void {
    const key = stops.join();
    if (key === this.key) return;
    this.key = key;
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, PALETTE_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      rasterizeGradient(stops, PALETTE_SIZE),
    );
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
  }
}
