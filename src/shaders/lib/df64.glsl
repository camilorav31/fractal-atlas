// ---------------------------------------------------------------------------
// df64 — "double-float" arithmetic.
//
// WebGL has no 64-bit floats, so a high-precision number is stored as the
// unevaluated sum of two float32 values: x = hi + lo, with |lo| <= ulp(hi)/2.
// That yields ~48 bits of mantissa (vs. 24), pushing the usable zoom depth
// from ~1e5 to ~1e13. The algorithms are the classic error-free transforms
// by Dekker (1971) and Knuth (TAOCP vol. 2), as used in the QD library.
//
// Representation: vec2(hi, lo).
// ---------------------------------------------------------------------------

// Veltkamp splitting constant for float32: 2^12 + 1.
const float DF64_SPLIT = 4097.0;

// ---------------------------------------------------------------------------
// Guarding against fast-math.
//
// Every error-free transform below depends on evaluating a subtraction in
// exactly the written order, e.g. two-sum's e = b - ((a + b) - a), which is
// *not* zero in IEEE arithmetic. Drivers that compile with fast-math (notably
// ANGLE on Metal) may reassociate it to (a + b) - (a + b) = 0, silently
// erasing the error term and collapsing df64 back to float32.
//
// `opaque` round-trips a value through its bit pattern XOR a uniform that is
// always 0. The compiler can't prove the XOR is a no-op and floating-point
// reassociation can't cross an integer op, so each wrapped intermediate is
// materialized and rounded exactly as IEEE 754 prescribes. Every rounding
// step the proofs rely on is wrapped; the cost is two ALU ops per wrap.
// ---------------------------------------------------------------------------
uniform uint u_zero;

float opaque(float x) {
  return uintBitsToFloat(floatBitsToUint(x) ^ u_zero);
}

// s + e == a + b exactly (Knuth two-sum, no ordering precondition).
vec2 twoSum(float a, float b) {
  float s = opaque(a + b);
  float v = opaque(s - a);
  float e = opaque(a - opaque(s - v)) + opaque(b - v);
  return vec2(s, e);
}

// Faster variant; requires |a| >= |b|.
vec2 quickTwoSum(float a, float b) {
  float s = opaque(a + b);
  float e = b - opaque(s - a);
  return vec2(s, e);
}

// Splits a float into two non-overlapping halves of 12 bits each.
vec2 split(float a) {
  float t = opaque(a * DF64_SPLIT);
  float hi = opaque(t - opaque(t - a));
  return vec2(hi, a - hi);
}

// p + e == a * b exactly (Dekker product). The partial products of the
// 12-bit halves are exact; only the order of the sums needs protecting.
vec2 twoProd(float a, float b) {
  float p = opaque(a * b);
  vec2 as = split(a);
  vec2 bs = split(b);
  float e = opaque(as.x * bs.x - p);
  e = opaque(e + as.x * bs.y);
  e = opaque(e + as.y * bs.x);
  return vec2(p, e + as.y * bs.y);
}

vec2 dfAdd(vec2 a, vec2 b) {
  vec2 s = twoSum(a.x, b.x);
  vec2 t = twoSum(a.y, b.y);
  s.y += t.x;
  s = quickTwoSum(s.x, s.y);
  s.y += t.y;
  return quickTwoSum(s.x, s.y);
}

vec2 dfSub(vec2 a, vec2 b) {
  return dfAdd(a, -b);
}

vec2 dfMul(vec2 a, vec2 b) {
  vec2 p = twoProd(a.x, b.x);
  p.y += a.x * b.y + a.y * b.x;
  return quickTwoSum(p.x, p.y);
}

vec2 dfSqr(vec2 a) {
  vec2 p = twoProd(a.x, a.x);
  p.y += 2.0 * a.x * a.y;
  return quickTwoSum(p.x, p.y);
}
