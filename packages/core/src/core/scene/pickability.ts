/** The `pickable` field of a node as a spread for `scene.add`: present only
 *  when the node states it, so an unstated one keeps the scene's default. */
export const pickability = (n: { pickable?: boolean }): { pickable?: boolean } =>
  n.pickable !== undefined ? { pickable: n.pickable } : {};
