/** `@weasel-js/geom/3d` — the same dependency-free geometry the root barrel
 *  offers, one dimension up. No camera, no viewport, no scene: those are the
 *  3D kernel's, and this is what it is built from.
 *
 *  The names deliberately repeat the 2D ones (`dot`, `scale`, `invert`). The
 *  subpath is the namespace; import one or the other, or alias at the call
 *  site. */
export {
  EPS3, add, sub, scale, dot, cross, len, len2, normalize,
  quatIdentity, quatFromAxisAngle,
  type Vec3, type Quat,
} from './vec3';
export {
  identity, multiply, transformPoint, transformPoint4, invert,
  compose, perspective, lookAt,
  type Mat4,
} from './mat4';
export {
  intersectRayAabb, intersectRayPlane, transformAabb, aabbAround,
  type Ray, type Aabb,
} from './ray3';
