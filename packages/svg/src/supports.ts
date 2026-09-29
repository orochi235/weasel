/**
 * `@supports` evaluation. A declaration test asks whether this parser would
 * honor the declaration ({@link isDeclarationHonored}), not whether a browser
 * could parse it — the answer decides whether the guarded rules apply here.
 */

import { ConditionSyntaxError, evaluateCondition } from './condition';
import { parseDeclaration } from './cssScan';
import { isDeclarationHonored } from './properties';

export interface SupportsOptions {
  /** Answers `selector(…)`; without it every selector test is false. */
  readonly selector?: (selector: string) => boolean;
}

/**
 * Whether a `@supports` condition holds. `selector()` defers to
 * `opts.selector`; any other function and any unrecognized parenthesized
 * content is false, so `not` of one is true. A malformed condition is false.
 */
export function evaluateSupports(condition: string, opts: SupportsOptions = {}): boolean {
  try {
    return evaluateCondition(condition, {
      paren: (inner) => {
        const d = parseDeclaration(inner);
        return d != null && isDeclarationHonored(d.prop, d.value);
      },
      fn: (name, args) => name === 'selector' && (opts.selector?.(args) ?? false),
    }) === true;
  } catch (e) {
    if (e instanceof ConditionSyntaxError) return false;
    throw e;
  }
}
