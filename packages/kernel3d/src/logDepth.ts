/**
 * Logarithmic depth: what a camera with `depth: 'log'` writes, and what a host
 * renderer drawing beside the line pass writes to match it.
 *
 * Standard depth spends its precision next to the near plane, so a near/far
 * ratio past about 1e4 leaves far surfaces sharing a depth value. Log depth
 * spreads it by distance instead: below the knee a step is a fixed length,
 * beyond it a fixed share of the distance. The fragment writes it; the vertex
 * shader and the projection are unchanged, so clipping at the near and far
 * planes stays exact.
 */

/** A camera's log depth: the knee, and the far plane every depth is measured against. */
export interface LogDepth {
  /** The distance where steps turn from a fixed length to a fixed share of the distance. */
  knee: number;
  far: number;
}

/** The depth, 0 at the eye to 1 at the far plane, that log depth writes at view distance `w`. */
export function logDepthAt(w: number, depth: LogDepth): number {
  const { knee, far } = depth;
  return 1 + Math.log2((w + knee) / (far + knee)) / Math.log2((far + knee) / knee);
}

/** The `vec3` that {@link LOG_DEPTH_GLSL}'s `weaselLogDepth` takes, as a uniform. */
export function logDepthUniform(depth: LogDepth): [number, number, number] {
  const { knee, far } = depth;
  return [knee, far + knee, 1 / Math.log2((far + knee) / knee)];
}

/**
 * GLSL ES 3.00, for a host's fragment shader: `weaselLogDepth(p)` is
 * {@link logDepthAt} for the fragment, with `p` from {@link logDepthUniform}.
 * Write it to `gl_FragDepth` under `precision highp float`. Measured as a ratio
 * to the far plane, the log stays small out there, so float32 keeps the steps
 * between far surfaces.
 */
export const LOG_DEPTH_GLSL = `
float weaselLogDepth(vec3 p) {
  return 1.0 + log2((1.0 / gl_FragCoord.w + p.x) / p.y) * p.z;
}
`;
