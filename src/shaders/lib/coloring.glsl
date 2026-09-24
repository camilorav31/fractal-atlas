// ---------------------------------------------------------------------------
// Shared coloring for escape-time fractals (Mandelbrot, Julia).
//
// The palette is a 256×1 sRGB texture sampled with REPEAT wrapping, so the
// gradient cycles seamlessly as the smooth iteration count grows. Because the
// texture is uploaded as SRGB8_ALPHA8, sampling returns *linear* light, which
// is what the accumulation buffer averages in.
// ---------------------------------------------------------------------------

uniform sampler2D u_palette;
uniform float u_colorDensity;   // palette cycles per 32 iterations
uniform float u_colorOffset;    // palette phase in [0, 1)
uniform float u_edgeShading;    // 0 = flat, 1 = full distance-estimate relief
uniform vec3 u_interiorColor;   // linear RGB
uniform bool u_linearOutput;    // false when the target cannot store linear light losslessly

// Radius 256 (instead of 2) makes the smooth iteration count virtually band-free.
const float ESCAPE_RADIUS_SQ = 65536.0;

// Normalized iteration count: n + 1 - log2(log2|z|). Continuous across bands.
float smoothIteration(float n, float r2) {
  return n + 1.0 - log2(0.5 * log2(r2));
}

// Exterior distance estimate |z| ln|z| / |z'|, expressed in pixels.
float distanceInPixels(float r2, vec2 dz, float pixelSize) {
  float r = sqrt(r2);
  return 0.5 * r * log(r2) / max(length(dz), 1e-30) / pixelSize;
}

vec3 exteriorColor(float nu, float dePixels) {
  float t = nu * u_colorDensity / 32.0 + u_colorOffset;
  vec3 color = texture(u_palette, vec2(t, 0.5)).rgb;

  // Filaments closer than ~1px to the set fade toward the interior colour,
  // giving thin structures a crisp, engraved edge instead of noisy speckle.
  float edge = smoothstep(0.0, 1.0, sqrt(clamp(dePixels * 0.5, 0.0, 1.0)));
  return mix(color, mix(u_interiorColor, color, edge), u_edgeShading);
}

vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

vec4 encodeOutput(vec3 linear) {
  return vec4(u_linearOutput ? linear : linearToSrgb(linear), 1.0);
}
