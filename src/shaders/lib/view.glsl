// ---------------------------------------------------------------------------
// Shared viewport uniforms: map this fragment to a point on the complex plane.
// ---------------------------------------------------------------------------

uniform vec2 u_resolution;   // full image size in px (larger than the canvas during export)
uniform vec2 u_tileOffset;   // offset of this draw inside the full image (tiled export)
uniform vec2 u_jitter;       // sub-pixel sample offset in [-0.5, 0.5] for progressive AA
uniform vec4 u_center;       // (re.hi, im.hi, re.lo, im.lo)
uniform float u_scale;       // complex-plane units per pixel
uniform int u_maxIterations;
uniform bool u_useDf64;

// Offset of this sample from the view centre. The pixel offset is small, so
// the product is accurate in float32 even when the centre itself is not.
vec2 sampleOffset() {
  vec2 pixel = gl_FragCoord.xy + u_tileOffset + u_jitter - 0.5 * u_resolution;
  return pixel * u_scale;
}

vec2 samplePointFp32() {
  return u_center.xy + sampleOffset();
}

// Sample coordinates in df64: re = (hi, lo), im = (hi, lo).
void samplePointDf64(out vec2 re, out vec2 im) {
  vec2 offset = sampleOffset();
  re = dfAdd(vec2(u_center.x, u_center.z), vec2(offset.x, 0.0));
  im = dfAdd(vec2(u_center.y, u_center.w), vec2(offset.y, 0.0));
}
