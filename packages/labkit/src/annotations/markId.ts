/** A mark's id is its target and its node. One scene per target, so a node id
 *  is only unique within one — and an annotation is addressed by both. */
export const markIdOf = (target: string, node: unknown): string => `${target}/${String(node)}`;

/** `markIdOf`'s inverse: the target is everything before the last `/`, which a target id may itself hold. */
export function splitMarkId(id: string): { target: string; node: string } | undefined {
  const at = id.lastIndexOf('/');
  return at <= 0 ? undefined : { target: id.slice(0, at), node: id.slice(at + 1) };
}
