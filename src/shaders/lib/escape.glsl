// ---------------------------------------------------------------------------
// The quadratic escape-time loop shared by Mandelbrot and Julia:
//
//     z ← z² + c
//
// The two sets differ only in what varies per pixel and what the derivative
// is taken against (it feeds the distance estimate):
//
//   Mandelbrot  z₀ = 0,     c = pixel   → dz/dc:  dz ← 2·z·dz + 1,  dz₀ = 0
//   Julia       z₀ = pixel, c = const   → dz/dz₀: dz ← 2·z·dz,      dz₀ = 1
//
// `dcTerm` is that trailing +1 (Mandelbrot) or +0 (Julia).
// Requires df64.glsl, coloring.glsl and view.glsl.
// ---------------------------------------------------------------------------

// Hard upper bound so the compiler can reason about the loop; the uniform decides.
const int ITERATION_CAP = 50000;

vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec3 escapeFp32(vec2 z, vec2 c, vec2 dz, float dcTerm) {
  for (int i = 0; i < ITERATION_CAP; i++) {
    if (i >= u_maxIterations) break;
    dz = 2.0 * complexMul(z, dz) + vec2(dcTerm, 0.0);
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    float r2 = dot(z, z);
    if (r2 > ESCAPE_RADIUS_SQ) {
      return exteriorColor(smoothIteration(float(i), r2), distanceInPixels(r2, dz, u_scale));
    }
  }
  return u_interiorColor;
}

vec3 escapeDf64(vec2 zRe, vec2 zIm, vec2 cRe, vec2 cIm, vec2 dz, float dcTerm) {
  for (int i = 0; i < ITERATION_CAP; i++) {
    if (i >= u_maxIterations) break;
    vec2 zRe2 = dfSqr(zRe);
    vec2 zIm2 = dfSqr(zIm);
    vec2 zReIm = dfMul(zRe, zIm);

    // The derivative only needs float32 precision.
    dz = 2.0 * complexMul(vec2(zRe.x, zIm.x), dz) + vec2(dcTerm, 0.0);

    zRe = dfAdd(dfSub(zRe2, zIm2), cRe);
    zIm = dfAdd(2.0 * zReIm, cIm);

    float r2 = zRe.x * zRe.x + zIm.x * zIm.x;
    if (r2 > ESCAPE_RADIUS_SQ) {
      return exteriorColor(smoothIteration(float(i), r2), distanceInPixels(r2, dz, u_scale));
    }
  }
  return u_interiorColor;
}
