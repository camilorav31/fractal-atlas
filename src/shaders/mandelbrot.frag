#version 300 es
precision highp float;
precision highp int;

// ---------------------------------------------------------------------------
// Mandelbrot set:  z_{n+1} = z_n^2 + c,  z_0 = 0, with c = the pixel.
// A point c belongs to the set iff the orbit stays bounded forever.
// ---------------------------------------------------------------------------

#include ./lib/df64.glsl;
#include ./lib/coloring.glsl;
#include ./lib/view.glsl;
#include ./lib/escape.glsl;

out vec4 outColor;

// Analytic early-out for the main cardioid and the period-2 bulb, which
// together cover most of the interior at shallow zoom.
bool inMainComponents(vec2 c) {
  float x = c.x - 0.25;
  float q = x * x + c.y * c.y;
  if (q * (q + x) <= 0.25 * c.y * c.y) return true;
  float x2 = c.x + 1.0;
  return x2 * x2 + c.y * c.y <= 0.0625;
}

void main() {
  vec3 color;
  if (u_useDf64) {
    // No analytic early-out here: at deep zoom the float32 test would misclassify
    // points within ~1e-7 of the cardioid boundary — exactly where people zoom.
    vec2 cRe, cIm;
    samplePointDf64(cRe, cIm);
    color = escapeDf64(vec2(0.0), vec2(0.0), cRe, cIm, vec2(0.0), 1.0);
  } else {
    vec2 c = samplePointFp32();
    color = inMainComponents(c) ? u_interiorColor : escapeFp32(vec2(0.0), c, vec2(0.0), 1.0);
  }
  outColor = encodeOutput(color);
}
