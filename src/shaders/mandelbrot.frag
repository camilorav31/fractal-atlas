#version 300 es
precision highp float;
precision highp int;

// ---------------------------------------------------------------------------
// Mandelbrot set:  z_{n+1} = z_n^2 + c,  z_0 = 0.
// A point c belongs to the set iff the orbit stays bounded forever.
//
// Two code paths share the same coloring:
//   • fp32 — fast, used while a pixel is still much larger than float epsilon.
//   • df64 — emulated double precision for deep zooms (see lib/df64.glsl).
// ---------------------------------------------------------------------------

#include ./lib/df64.glsl;
#include ./lib/coloring.glsl;

uniform vec2 u_resolution;   // full image size in px (larger than the canvas during export)
uniform vec2 u_tileOffset;   // offset of this draw inside the full image (tiled export)
uniform vec2 u_jitter;       // sub-pixel sample offset in [-0.5, 0.5] for progressive AA
uniform vec4 u_center;       // (re.hi, im.hi, re.lo, im.lo)
uniform float u_scale;       // complex-plane units per pixel
uniform int u_maxIterations;
uniform bool u_useDf64;

out vec4 outColor;

// Hard upper bound so the compiler can reason about the loop; the uniform decides.
const int ITERATION_CAP = 50000;

// Analytic early-out for the main cardioid and the period-2 bulb, which
// together cover most of the interior at shallow zoom.
bool inMainComponents(vec2 c) {
  float x = c.x - 0.25;
  float q = x * x + c.y * c.y;
  if (q * (q + x) <= 0.25 * c.y * c.y) return true;
  float x2 = c.x + 1.0;
  return x2 * x2 + c.y * c.y <= 0.0625;
}

vec3 shadeFp32(vec2 c) {
  if (inMainComponents(c)) return u_interiorColor;

  vec2 z = vec2(0.0);
  vec2 dz = vec2(0.0);
  for (int i = 0; i < ITERATION_CAP; i++) {
    if (i >= u_maxIterations) break;
    // z' = 2·z·z' + 1  (derivative for the distance estimate)
    dz = 2.0 * vec2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + vec2(1.0, 0.0);
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    float r2 = dot(z, z);
    if (r2 > ESCAPE_RADIUS_SQ) {
      return exteriorColor(smoothIteration(float(i), r2), distanceInPixels(r2, dz, u_scale));
    }
  }
  return u_interiorColor;
}

vec3 shadeDf64(vec2 cRe, vec2 cIm) {
  // No analytic early-out here: at deep zoom the float32 test would misclassify
  // points within ~1e-7 of the cardioid boundary — exactly where people zoom.
  vec2 zRe = vec2(0.0);
  vec2 zIm = vec2(0.0);
  vec2 dz = vec2(0.0); // the derivative only needs float32 precision
  for (int i = 0; i < ITERATION_CAP; i++) {
    if (i >= u_maxIterations) break;
    vec2 zRe2 = dfSqr(zRe);
    vec2 zIm2 = dfSqr(zIm);
    vec2 zReIm = dfMul(zRe, zIm);

    vec2 z = vec2(zRe.x, zIm.x);
    dz = 2.0 * vec2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + vec2(1.0, 0.0);

    zRe = dfAdd(dfSub(zRe2, zIm2), cRe);
    zIm = dfAdd(2.0 * zReIm, cIm);

    float r2 = zRe.x * zRe.x + zIm.x * zIm.x;
    if (r2 > ESCAPE_RADIUS_SQ) {
      return exteriorColor(smoothIteration(float(i), r2), distanceInPixels(r2, dz, u_scale));
    }
  }
  return u_interiorColor;
}

void main() {
  // Pixel offset from the image centre, in pixels. Small enough to be exact in float32.
  vec2 pixel = gl_FragCoord.xy + u_tileOffset + u_jitter - 0.5 * u_resolution;
  vec2 offset = pixel * u_scale;

  vec3 color;
  if (u_useDf64) {
    vec2 cRe = dfAdd(vec2(u_center.x, u_center.z), vec2(offset.x, 0.0));
    vec2 cIm = dfAdd(vec2(u_center.y, u_center.w), vec2(offset.y, 0.0));
    color = shadeDf64(cRe, cIm);
  } else {
    color = shadeFp32(u_center.xy + offset);
  }
  outColor = encodeOutput(color);
}
