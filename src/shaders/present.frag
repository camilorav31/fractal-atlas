#version 300 es
precision highp float;

// ---------------------------------------------------------------------------
// Present pass: resolves the accumulation buffer onto the screen (or an
// export tile). Converts linear light to sRGB and adds triangular-PDF dither
// so smooth gradients never band when quantized to 8 bits.
// ---------------------------------------------------------------------------

in vec2 v_uv;

uniform sampler2D u_image;
uniform vec2 u_uvScale;      // fraction of the accumulation buffer in use (dynamic resolution)
uniform bool u_linearInput;
uniform float u_vignette;    // 0 for exports, subtle on screen
uniform float u_seed;

out vec4 outColor;

vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 color = texture(u_image, v_uv * u_uvScale).rgb;
  if (u_linearInput) color = linearToSrgb(max(color, 0.0));

  vec2 q = v_uv - 0.5;
  color *= 1.0 - u_vignette * dot(q, q) * 1.6;

  vec2 p = gl_FragCoord.xy + u_seed;
  float dither = (hash(p) + hash(p + 17.31) - 1.0) / 255.0;
  outColor = vec4(color + dither, 1.0);
}
