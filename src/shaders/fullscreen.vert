#version 300 es

// A single oversized triangle that covers the whole viewport.
// Cheaper than a quad and free of the diagonal seam two triangles can leave.
// Vertices are generated from gl_VertexID, so no vertex buffer is required.

out vec2 v_uv;

void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
