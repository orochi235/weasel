/**
 * Named predicates for `defaultBinding.target.kindOf`. Each matches the
 * existing `kindOf` signature `(target: unknown, bodyTarget?: string) => boolean`
 * so they drop into action descriptors without a wrapper:
 *
 *     target: { kindOf: isAnchor }
 *
 * Single source of truth for "what does this affordance kind mean" — adding
 * a new predicate here is what enables every action that needs the same
 * shape to read it. Drift prevention.
 */

// ─── Body-class predicates (read the second arg) ───────────────────────

/** A predicate that resolves from `bodyTarget` alone. The exclusive-claim
 *  filter reads `readsAffordance`: without it a body predicate looks like it
 *  consults the hit, and survives a claim that should have barred it. */
export type BodyPredicate = ((target: unknown, bodyTarget?: string) => boolean)
  & { readsAffordance: false };

function bodyPredicate(
  fn: (target: unknown, bodyTarget?: string) => boolean,
): BodyPredicate {
  return Object.assign(fn, { readsAffordance: false as const });
}

/** Matches any body hit — selected or unselected node body. */
export const isBody: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'selected-body' || bodyTarget === 'unselected-body');

/** Body hit specifically already in the selection. */
export const isSelectedBody: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'selected-body');

/** Body hit specifically NOT in the selection. */
export const isUnselectedBody: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'unselected-body');

/** Empty-canvas hit — no node beneath cursor. */
export const isEmpty: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'empty');

// ─── Affordance-kind predicates (read the first arg) ───────────────────

function kindOf(target: unknown): string | undefined {
  if (typeof target !== 'object' || target === null) return undefined;
  const k = (target as { kind?: unknown }).kind;
  return typeof k === 'string' ? k : undefined;
}

/** Any corner resize handle — top-left/top-right/bottom-left/bottom-right. */
export const isResizeHandle = (target: unknown): boolean => {
  const k = kindOf(target);
  return k !== undefined && k.startsWith('handle:');
};

/** The rotate-around-center handle above the bounding box. */
export const isRotateHandle = (target: unknown): boolean =>
  kindOf(target) === 'rotate-handle';

/** Any path anchor (the on-curve dot). */
export const isAnchor = (target: unknown): boolean => {
  const k = kindOf(target);
  return k !== undefined && /^anchor:\d+$/.test(k);
};

/** Either control handle (controlIn or controlOut). */
export const isControlHandle = (target: unknown): boolean => {
  const k = kindOf(target);
  return k !== undefined && /^(controlIn|controlOut):\d+$/.test(k);
};

/** Any of the three anchor-editing affordances (anchor + both controls). */
export const isAnchorOrControl = (target: unknown): boolean =>
  isAnchor(target) || isControlHandle(target);
