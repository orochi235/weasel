import { HEAD_OVERDRAW } from './head';
import { ROLE_SHAFT_END, ROLE_TIP } from './pack';

/**
 * A line is expanded in screen space after projection: its width and its head
 * are pixels, so a line across the whole scene is as legible as one beside the
 * camera. Every vertex carries both ends of its segment, which is what gives
 * it a direction on screen.
 *
 * The shaft stops under the head at a length along the run, so it is cut where
 * it lies. The head stands back from the tip along its own segment's straight
 * direction on screen, never back along the path: a head longer than its
 * segment would otherwise interpolate past the segment's end and run the
 * perspective divide through zero. The scale a head is sized by is read from
 * the run's last segment, which every vertex of the run carries, so every
 * segment cuts its shaft at the same place.
 */
export const LINE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_from;
layout(location = 1) in vec3 a_to;
layout(location = 2) in vec3 a_adj;
layout(location = 3) in vec2 a_corner;
layout(location = 4) in vec3 a_along;
layout(location = 5) in vec4 a_shape;
layout(location = 6) in vec3 a_apex;
layout(location = 7) in vec4 a_apexBack;
layout(location = 8) in vec4 a_color;
uniform mat4 u_viewProjection;
/* Half the viewport in CSS pixels: ndc times this is pixels. */
uniform vec2 u_halfViewport;
out vec4 v_color;
const float OVERDRAW = ${HEAD_OVERDRAW.toFixed(3)};
/* How far a bisector may stretch before the corner is let go; a hairpin would run to infinity. */
const float MITER_LIMIT = 4.0;
const vec4 CULLED = vec4(0.0, 0.0, 2.0, 1.0);

vec2 screenOf(vec4 c) { return c.xy / c.w * u_halfViewport; }

void main() {
  v_color = a_color;
  vec4 ca = u_viewProjection * vec4(a_from, 1.0);
  vec4 cb = u_viewProjection * vec4(a_to, 1.0);
  /* An end behind the eye projects to a line across the whole screen; drop the segment instead. */
  if (ca.w <= 0.0 || cb.w <= 0.0) { gl_Position = CULLED; return; }
  vec2 sa = screenOf(ca);
  vec2 sb = screenOf(cb);
  vec2 d = sb - sa;
  float L = length(d);
  vec2 dir = L > 0.0 ? d / L : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float role = a_corner.x;
  float side = a_corner.y;
  float s0 = a_along.x;
  float s1 = a_along.y;
  float total = a_along.z;
  float span = s1 - s0;

  /* Pixels per unit near the tip, the same for every segment of the run; this segment's own where the tip is unseen. */
  float density = span > 0.0 ? L / span : 0.0;
  vec4 cp = u_viewProjection * vec4(a_apex, 1.0);
  vec4 cq = u_viewProjection * vec4(a_apexBack.xyz, 1.0);
  float reach = a_apexBack.w;
  if (reach > 0.0 && cp.w > 0.0 && cq.w > 0.0) {
    float px = length(screenOf(cp) - screenOf(cq));
    if (px > 0.0) density = px / reach;
  }

  /* layoutLine in head.ts, repeated. */
  float shaftHalf = a_shape.x;
  float wanted = shaftHalf * a_shape.y;
  float headPx = 0.0;
  float headHalf = 0.0;
  float shaft = shaftHalf;
  float shaftEnd = total;
  if (wanted > 0.0 && density > 0.0) {
    headPx = max(0.0, min(wanted, a_shape.z * density * total));
    headHalf = headPx * a_shape.w;
    shaft = min(shaftHalf * (headPx / wanted), headHalf);
    shaftEnd = total - headPx / density * (1.0 - OVERDRAW);
  }

  if (role > ${(ROLE_SHAFT_END + 0.5).toFixed(1)}) {
    if (headPx <= 0.0) { gl_Position = CULLED; return; }
    if (role > ${(ROLE_TIP - 0.5).toFixed(1)}) { gl_Position = cb; return; }
    vec2 base = sb - dir * headPx + perp * side * headHalf;
    gl_Position = vec4(base / u_halfViewport * cb.w, cb.z, cb.w);
    return;
  }

  float to = min(s1, shaftEnd);
  if (to <= s0 || span <= 0.0) { gl_Position = CULLED; return; }
  bool atEnd = role > 0.5;
  /* Clip space is linear in the world, so a fraction of the segment lands at its true depth. */
  vec4 c = mix(ca, cb, atEnd ? (to - s0) / span : 0.0);
  vec2 miter = perp;
  float stretch = 1.0;
  /* Only an end that meets its neighbor miters; a shaft cut short under the head stays square. */
  if (!atEnd || to >= s1) {
    vec4 cj = u_viewProjection * vec4(a_adj, 1.0);
    if (cj.w > 0.0) {
      vec2 sj = screenOf(cj);
      vec2 e = atEnd ? sj - sb : sa - sj;
      float eL = length(e);
      if (eL > 0.0) {
        vec2 o = e / eL;
        vec2 bisect = perp + vec2(-o.y, o.x);
        float bL = length(bisect);
        if (bL > 0.0001) {
          vec2 m = bisect / bL;
          float cosHalf = dot(m, perp);
          if (cosHalf > 1.0 / MITER_LIMIT) { miter = m; stretch = 1.0 / cosHalf; }
        }
      }
    }
  }
  c.xy += miter * side * shaft * stretch / u_halfViewport * c.w;
  gl_Position = c;
}`;

/** Flat color, straight alpha. */
export const LINE_FS = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}`;
