import { getGestureDescriptor, type GestureName } from './gestures';
import type { ParsedRoute, PhaseAtom, ParsedModifiers, ModName } from './routeGrammar';

const MOD_NAMES: Record<ModName, string> = {
  mod: 'Mod', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl', meta: 'Meta',
};
const MOD_ORDER: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

/** Glossary for route-vocabulary terms surfaced by `describeRouteParts`.
 *  Exposed so docs / inspector UIs can render the same definitions. */
export const ROUTE_TERMS = {
  idle: 'Not in the middle of a drag or other synchronous operation.',
  'mid-gesture': 'In the middle of a drag or other synchronous operation.',
} as const;

/** Per-field explanations for the slots of a parsed route. Exposed so
 *  inspector UIs / docs can describe what each setting in a route table
 *  means without duplicating prose. */
export const ROUTE_FIELD_DEFINITIONS = {
  phases: 'Which lifecycle stage(s) a channel must be in for this route to fire. `initial` = the channel is idle; `engaged` = the channel is mid-gesture. The channel is the binding\'s own tool (`&`), any tool (`*`), or a named tool id.',
  gesture: 'The class of input event that triggers this route — click, drag, double-tap, keyDown/keyUp, wheel, contextMenu, or multiTouchTap.',
  arg: 'Sub-class of the gesture. Direction for wheel (up / down / *), key name for keyDown / keyUp, finger count for multiTouchTap. Other gestures have no arg slot.',
  target: 'Which hit-test result the gesture must land on. `*` matches any target; `empty` matches the empty canvas; otherwise the value names a specific hit-target kind.',
  modifiers: 'Modifier keys the user must hold (`+key`) or may optionally hold (`?key`) for this route to match. Unlisted modifiers must not be held.',
} as const;

export type RouteFieldName = keyof typeof ROUTE_FIELD_DEFINITIONS;

export type RouteTermLabel = keyof typeof ROUTE_TERMS;

/** A part of a structured route description. `string` parts are plain prose;
 *  `term` parts carry a glossary lookup so renderers can attach tooltips. */
export type RouteDescriptionPart =
  | string
  | { kind: 'term'; label: RouteTermLabel; definition: string };

function term(label: RouteTermLabel): RouteDescriptionPart {
  return { kind: 'term', label, definition: ROUTE_TERMS[label] };
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function partitionModifiers(mods: ParsedModifiers): { required: string[]; optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];
  for (const name of MOD_ORDER) {
    const req = mods[name];
    if (req === 'required') required.push(MOD_NAMES[name]);
    else if (req === 'optional') optional.push(MOD_NAMES[name]);
  }
  return { required, optional };
}

function phaseAtomParts({ channel, phase }: PhaseAtom): RouteDescriptionPart[] {
  const subject = channel === '&' ? 'the tool'
    : channel === '*' ? 'any tool'
    : `the ${channel} tool`;
  if (phase === 'initial') return [`${subject} is `, term('idle')];
  if (phase === 'engaged') return [`${subject} is `, term('mid-gesture')];
  return [`${subject} is in any phase`];
}

function phasesParts(phases: readonly PhaseAtom[]): RouteDescriptionPart[] {
  if (phases.length === 1) return phaseAtomParts(phases[0]);
  const out: RouteDescriptionPart[] = [];
  phases.forEach((p, i) => {
    if (i > 0) out.push(' or ');
    out.push(...phaseAtomParts(p));
  });
  return out;
}

function targetClause(target: string | undefined, hasTarget: boolean): string {
  if (!hasTarget || target === undefined) return '';
  if (target === '*') return ' anywhere';
  if (target === 'empty') return ' on empty canvas';
  return ` on a ${target}`;
}

function actionClause(parsed: ParsedRoute, required: readonly string[]): string {
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const modPrefix = required.length > 0 ? `${joinAnd(required)}-` : '';
  const target = targetClause(parsed.target, desc.hasTarget);

  switch (parsed.gesture) {
    case 'keyDown':
    case 'keyUp':
    case 'keyHeld': {
      const verb = parsed.gesture === 'keyDown' ? 'presses'
        : parsed.gesture === 'keyUp' ? 'releases'
        : 'holds';
      const key = parsed.arg ?? 'any key';
      return required.length > 0
        ? `the user holds ${joinAnd(required)} and ${verb} ${key}`
        : `the user ${verb} ${key}`;
    }
    case 'wheel': {
      const direction = parsed.arg === 'up' ? ' up'
        : parsed.arg === 'down' ? ' down'
        : '';
      return `the user ${modPrefix}scrolls${direction}`;
    }
    case 'multiTouchTap':
      return `the user taps with ${parsed.arg ?? 'multiple'} fingers`;
    case 'contextMenu':
      return `the user ${modPrefix}opens the context menu${target}`;
    case 'click':
      return `the user ${modPrefix}clicks${target}`;
    case 'pointerDown':
      return `the user ${modPrefix}presses${target}`;
    case 'dblTap':
      return `the user ${modPrefix}double-taps${target}`;
    case 'drag':
      return `the user ${modPrefix}drags${target}`;
  }
}

export interface DescribeRouteOptions {
  /** Capitalize the first letter of the result. Default true. */
  capitalize?: boolean;
  /** Trailing period. Default true. */
  period?: boolean;
}

/** Structured description of when a parsed route fires. Returns an array of
 *  prose strings interspersed with `term` parts (e.g. `idle`, `mid-gesture`)
 *  so React-based renderers can attach hover-definition tooltips. Use
 *  `describeRoute()` for a plain-string version. */
export function describeRouteParts(
  parsed: ParsedRoute,
  opts: DescribeRouteOptions = {},
): readonly RouteDescriptionPart[] {
  const { capitalize = true, period = true } = opts;
  const { required, optional } = partitionModifiers(parsed.modifiers);
  const action = actionClause(parsed, required);
  const optClause = optional.length > 0
    ? ` (${joinAnd(optional)} optional)`
    : '';

  const parts: RouteDescriptionPart[] = [];
  const head = `fires when ${action}, while `;
  parts.push(capitalize ? head.charAt(0).toUpperCase() + head.slice(1) : head);
  parts.push(...phasesParts(parsed.phases));
  if (optClause) parts.push(optClause);
  if (period) parts.push('.');
  return mergeAdjacentStrings(parts);
}

/** Plain-spoken English summary of when a parsed route fires. Intended for
 *  developer-facing documentation. Term parts collapse to their label only
 *  (e.g. `idle`); use `describeRouteParts()` if you want to expose the
 *  glossary definitions in your renderer. */
export function describeRoute(parsed: ParsedRoute, opts: DescribeRouteOptions = {}): string {
  return describeRouteParts(parsed, opts)
    .map((p) => (typeof p === 'string' ? p : p.label))
    .join('');
}

function mergeAdjacentStrings(parts: readonly RouteDescriptionPart[]): RouteDescriptionPart[] {
  const out: RouteDescriptionPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (typeof p === 'string' && typeof last === 'string') out[out.length - 1] = last + p;
    else out.push(p);
  }
  return out;
}
