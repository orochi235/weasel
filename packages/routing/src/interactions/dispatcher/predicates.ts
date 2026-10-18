/**
 * Named predicates for `defaultBinding.target.kindOf`. Each matches the
 * `TargetPredicate` shape, declaring whether it reads the hit,
 * so they drop into action descriptors without a wrapper:
 *
 *     target: { kindOf: isAnchor }
 *
 * Single source of truth for "what does this affordance kind mean" — adding
 * a new predicate here is what enables every action that needs the same
 * shape to read it. Drift prevention.
 */
import { bodyPredicate, hitPredicate, type TargetPredicate } from '@weasel-js/gestures';

// ─── Body-class predicates (read the second arg) ───────────────────────

/** A predicate that resolves from `bodyTarget` alone. */
export type BodyPredicate = TargetPredicate & { readsAffordance: false };

/** Matches any body hit — selected or unselected node body. */
export const isBody: BodyPredicate = bodyPredicate((bodyTarget) =>
  bodyTarget === 'selected-body' || bodyTarget === 'unselected-body');

/** Body hit specifically already in the selection. */
export const isSelectedBody: BodyPredicate = bodyPredicate((bodyTarget) =>
  bodyTarget === 'selected-body');

/** Body hit specifically NOT in the selection. */
export const isUnselectedBody: BodyPredicate = bodyPredicate((bodyTarget) =>
  bodyTarget === 'unselected-body');

/** Empty-canvas hit — no node beneath cursor. */
export const isEmpty: BodyPredicate = bodyPredicate((bodyTarget) =>
  bodyTarget === 'empty');

// ─── Affordance-kind predicates (read the first arg) ───────────────────

function kindOf(target: unknown): string | undefined {
  if (typeof target !== 'object' || target === null) return undefined;
  const k = (target as { kind?: unknown }).kind;
  return typeof k === 'string' ? k : undefined;
}

/** Any resize handle: a corner (`handle:top-left`, …) or an edge (`handle:top`, …). */
export const isResizeHandle = hitPredicate((target) => {
  const k = kindOf(target);
  return k !== undefined && k.startsWith('handle:');
});

/** The rotate-around-center handle above the bounding box. */
export const isRotateHandle = hitPredicate((target) =>
  kindOf(target) === 'rotate-handle');

/** Any path anchor (the on-curve dot). */
export const isAnchor = hitPredicate((target) => {
  const k = kindOf(target);
  return k !== undefined && /^anchor:\d+$/.test(k);
});

/** Either control handle (controlIn or controlOut). */
export const isControlHandle = hitPredicate((target) => {
  const k = kindOf(target);
  return k !== undefined && /^(controlIn|controlOut):\d+$/.test(k);
});

/** A corner-shape widget, set inside a corner anchor of the edited path. */
export const isCornerWidget = hitPredicate((target) => {
  const k = kindOf(target);
  return k !== undefined && /^corner:\d+$/.test(k);
});

/** Any of the three anchor-editing affordances (anchor + both controls). */
export const isAnchorOrControl = hitPredicate((target) =>
  isAnchor(target) || isControlHandle(target));

/** The outline of the path being edited, between its anchors. */
export const isSegment = hitPredicate((target) => kindOf(target) === 'segment');

/** The grip midway along a curved segment's balance line, `balance:N`, where
 *  N is the flat index of the anchor the segment starts at. */
export const isBalanceGrip = hitPredicate((target) => {
  const k = kindOf(target);
  return k !== undefined && /^balance:\d+$/.test(k);
});

/** Anything path edit puts on the path: an anchor, a control, a segment, a
 *  segment's balance grip, or a corner widget. */
export const isPathEditPart = hitPredicate((target) =>
  isAnchorOrControl(target) || isSegment(target) || isBalanceGrip(target) || isCornerWidget(target));
