/** Target matching: a `TargetSpec` against what an event classified under its point. */

import type { TargetSpec, TargetPredicate } from './spec';

/** Read a `.kind` string off an affordance hit, or `undefined` when the hit
 *  is absent or shaped differently. */
function affordanceKindOf(target: unknown): string | undefined {
  if (typeof target !== 'object' || target === null) return undefined;
  const k = (target as { kind?: unknown }).kind;
  return typeof k === 'string' ? k : undefined;
}

/**
 * A {@link TargetSpec} resolved to its form, with the parts each form encodes
 * in its string pulled out. This is the one enumeration of the target forms:
 * sites that act on it switch on `form` exhaustively rather than re-deriving
 * the prefixes.
 */
export type TargetSpecForm =
  | { form: 'body'; body: 'empty' | 'selected-body' | 'unselected-body' }
  | { form: 'kind'; kind: string; requireSelected: boolean }
  | { form: 'affordance'; kind: string }
  | { form: 'predicate'; kindOf: TargetPredicate };

function hasPrefix<P extends string>(s: string, prefix: P): s is `${P}${string}` {
  return s.startsWith(prefix);
}

/**
 * Resolve a `TargetSpec` to its {@link TargetSpecForm}.
 *
 * `null` means the value is no form this build knows — junk from an untyped
 * consumer, or a spec authored against a newer kit. Every caller treats it as
 * no-match rather than a wildcard.
 */
export function parseTargetSpec(spec: TargetSpec): TargetSpecForm | null {
  if (typeof spec === 'object') {
    return spec !== null && typeof spec.kindOf === 'function'
      ? { form: 'predicate', kindOf: spec.kindOf }
      : null;
  }
  if (typeof spec !== 'string') return null;
  if (spec === 'empty' || spec === 'selected-body' || spec === 'unselected-body') {
    return { form: 'body', body: spec };
  }
  if (hasPrefix(spec, 'affordance:')) {
    return { form: 'affordance', kind: spec.slice('affordance:'.length) };
  }
  // `:selected` is only a suffix when it is the LAST segment — `kind:app:note`
  // names a kind that happens to contain a colon.
  if (hasPrefix(spec, 'kind:')) {
    const rest = spec.slice('kind:'.length);
    const requireSelected = rest.endsWith(':selected');
    return {
      form: 'kind',
      kind: requireSelected ? rest.slice(0, -':selected'.length) : rest,
      requireSelected,
    };
  }
  const _exhaustive: never = spec;
  void _exhaustive;
  return null;
}

/**
 * Match a target value + event against a TargetSpec.
 *
 * - `{ kindOf: predicate }` — calls the predicate with the affordance hit and
 *   the `bodyTarget` string.
 * - `'empty'`, `'selected-body'`, `'unselected-body'` — compared against
 *   `bodyTarget` on the event.
 * - `kind:<k>` — compared against `bodyKind`, the *semantic* kind of the node
 *   body under the point (`'text'`, `'rect'`, an app's own `'app:note'`).
 *   Selection-agnostic.
 * - `kind:<k>:selected` — the same, and additionally requires the body to be
 *   in the current selection. Only the final `:selected` is a suffix, so a
 *   kind may itself contain colons.
 * - `affordance:<k>` — exact match against the affordance hit's own `kind`.
 *   Kit affordance kinds are `handle:<corner>`, `'rotate-handle'`,
 *   `anchor:<i>`, `controlIn:<i>` / `controlOut:<i>`, and `layer:<id>` for a
 *   registered layer's widget. The match is exact and includes any parameter,
 *   so "any anchor" needs the `isAnchor` predicate rather than this form.
 * - `undefined` spec.target — any target is accepted.
 *
 * Every string form resolves to `false` when the field it reads is absent, so
 * an unwired `classifyTarget`/`affordanceAt` yields no-match rather than a
 * silent wildcard.
 */
export function matchTarget(
  target: unknown,
  specTarget: TargetSpec | undefined,
  bodyTarget?: string,
  bodyKind?: string,
): boolean {
  if (specTarget === undefined) return true;
  const form = parseTargetSpec(specTarget);
  if (form === null) return false;

  switch (form.form) {
    // Receives the affordance hit plus the bodyTarget classification.
    case 'predicate':
      return form.kindOf(target, bodyTarget);

    // Resolved from the `classifyTarget` result packed into the event's
    // `bodyTarget`. Unwired classifyTarget → absent → no match.
    case 'body':
      return bodyTarget !== undefined && bodyTarget === form.body;

    case 'affordance':
      return affordanceKindOf(target) === form.kind;

    case 'kind':
      if (bodyKind === undefined || bodyKind !== form.kind) return false;
      return form.requireSelected ? bodyTarget === 'selected-body' : true;

    default: {
      // Exhaustiveness guard — new target forms are a compile error here.
      const _exhaustive: never = form;
      void _exhaustive;
      return false;
    }
  }
}
