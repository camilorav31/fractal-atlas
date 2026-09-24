#version 300 es
precision highp float;
precision highp int;

// ---------------------------------------------------------------------------
// Julia set:  z_{n+1} = z_n^2 + c,  z_0 = the pixel, with c fixed.
// The filled Julia set K_c is every starting point whose orbit stays bounded.
// ---------------------------------------------------------------------------

#include ./lib/df64.glsl;
#include ./lib/coloring.glsl;
#include ./lib/view.glsl;
#include ./lib/escape.glsl;

uniform vec4 u_c; // the constant, as df64: (re.hi, im.hi, re.lo, im.lo)

out vec4 outColor;

void main() {
  vec3 color;
  if (u_useDf64) {
    vec2 zRe, zIm;
    samplePointDf64(zRe, zIm);
    color = escapeDf64(zRe, zIm, vec2(u_c.x, u_c.z), vec2(u_c.y, u_c.w), vec2(1.0, 0.0), 0.0);
  } else {
    color = escapeFp32(samplePointFp32(), u_c.xy + u_c.zw, vec2(1.0, 0.0), 0.0);
  }
  outColor = encodeOutput(color);
}
