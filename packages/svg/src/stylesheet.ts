/** Stylesheet text read into cascade rules: conditional at-rules, layers and source order. */

import { parseDeclarations, skipBlock, skipString, splitTopLevel, stripComments, type Declaration } from './cssScan';
import { specificity, type Specificity } from './specificity';
import { DEFAULT_MEDIA_ENVIRONMENT, evaluateMediaQuery, type SvgMediaEnvironment } from './media';
import { evaluateSupports } from './supports';

/** One selector from a style rule; a comma list becomes one rule per selector. */
export interface StyleRule {
  readonly selector: string;
  readonly declarations: readonly Declaration[];
  /** `[ids, classes/attributes/pseudo-classes, types/pseudo-elements]`. */
  readonly specificity: Specificity;
  /** Source position across every `<style>` in the document. */
  readonly order: number;
  /** The cascade layer's full dotted name; `''` is unlayered. An anonymous layer's segment starts with U+0000. */
  readonly layer: string;
  /** The prelude of each `@container` block around the rule, outermost first. */
  readonly containers?: readonly string[];
}

/** What a stylesheet's conditional at-rules are evaluated against. */
export interface StylesheetContext {
  /** The environment `@media` answers to; {@link DEFAULT_MEDIA_ENVIRONMENT} when omitted. */
  readonly media?: SvgMediaEnvironment;
  /** Answers `@supports selector(…)`; every selector test is false without it. */
  readonly selector?: (selector: string) => boolean;
  /** Receives a notice for each `@import`, which is never fetched. */
  readonly onWarn?: (message: string) => void;
}

/**
 * The cascade layers a document declares, in the order CSS Cascade 5 ranks
 * them. Several sheets share one, since a layer's position is fixed by its
 * first declaration anywhere in the document.
 */
export class CascadeLayers {
  private readonly children = new Map<string, string[]>();
  private anonymous = 0;

  /** Declare `name` (possibly dotted) inside `parent`, keeping any earlier position; returns its full name. */
  declare(parent: string, name: string): string {
    let full = parent;
    for (const segment of name.split('.')) {
      const child = full ? `${full}.${segment}` : segment;
      const siblings = this.children.get(full) ?? [];
      if (!siblings.includes(child)) {
        siblings.push(child);
        this.children.set(full, siblings);
      }
      full = child;
    }
    return full;
  }

  /** A fresh layer inside `parent` that nothing can reopen. */
  declareAnonymous(parent: string): string {
    return this.declare(parent, `\u0000${this.anonymous++}`);
  }

  /**
   * Each layer's rank for normal declarations, higher winning: a layer's
   * sublayers rank below its own rules, in declaration order, and unlayered
   * rules (`''`) rank above every layer.
   */
  ranks(): ReadonlyMap<string, number> {
    const out = new Map<string, number>();
    const visit = (name: string): void => {
      for (const child of this.children.get(name) ?? []) visit(child);
      out.set(name, out.size);
    };
    visit('');
    return out;
  }
}

/**
 * Parse stylesheet text into rules. `@media` and `@supports` blocks
 * contribute their rules when their condition holds against `ctx`, nested to
 * any depth, and `@layer` blocks contribute theirs tagged with the layer,
 * which is declared into `layers`. `@container` blocks contribute theirs
 * tagged with the query, which is answered per element. `@import` is reported
 * and not fetched; every other at-rule (`@font-face`, `@keyframes`, …) is
 * skipped whole, as are nested blocks inside a rule body. `order` continues
 * from `firstOrder` so several sheets share one source order.
 */
export function parseStylesheet(
  text: string, firstOrder = 0, ctx: StylesheetContext = {}, layers = new CascadeLayers(),
): StyleRule[] {
  const src = stripComments(text).replace(/<!\[CDATA\[|\]\]>|<!--|-->/g, ' ');
  const rules: StyleRule[] = [];
  parseRuleList(src, 0, src.length, '', ctx, rules, { order: firstOrder, importsAllowed: true, layers });
  return rules;
}

const IDENT = '-?[a-zA-Z_\\u0080-\\uffff][\\w\\u0080-\\uffff-]*';
const LAYER_NAME = new RegExp(`^${IDENT}(?:\\.${IDENT})*$`);

/** The names in a `@layer` prelude, or null when any is malformed. */
function layerNames(prelude: string): string[] | null {
  if (!prelude.trim()) return [];
  const names = splitTopLevel(prelude, ',').map((n) => n.trim());
  return names.every((n) => LAYER_NAME.test(n)) ? names : null;
}

const AT_RULE = /^@([\w-]+)\s*([\s\S]*)$/;

interface ListState {
  order: number;
  /** `@import` is valid only at the top of a sheet, ahead of every rule but `@charset` and `@layer`. */
  importsAllowed: boolean;
  readonly layers: CascadeLayers;
  /** The `@container` preludes around the rules being read. */
  containers?: readonly string[];
}

function parseRuleList(
  src: string, from: number, to: number, layer: string, ctx: StylesheetContext, rules: StyleRule[], state: ListState,
): void {
  let i = from;
  let preludeStart = from;
  while (i < to) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { i = skipString(src, i); continue; }
    if (ch === ';') {
      const text = src.slice(preludeStart, i).trim();
      const statement = AT_RULE.exec(text);
      const name = statement?.[1].toLowerCase();
      if (name === 'import' && state.importsAllowed) {
        ctx.onWarn?.(`@import ${statement?.[2]} is not fetched; its rules do not apply`);
      } else if (name === 'layer') {
        for (const n of layerNames(statement?.[2] ?? '') ?? []) state.layers.declare(layer, n);
      } else if (text && name !== 'charset') {
        state.importsAllowed = false;
      }
      i++;
      preludeStart = i;
      continue;
    }
    if (ch !== '{') { i++; continue; }
    const prelude = src.slice(preludeStart, i).trim();
    const end = Math.min(skipBlock(src, i), to);
    const at = AT_RULE.exec(prelude);
    state.importsAllowed = false;
    if (at) {
      const name = at[1].toLowerCase();
      const names = name === 'layer' ? layerNames(at[2]) : null;
      if (names && names.length <= 1) {
        const inner = names.length ? state.layers.declare(layer, names[0]) : state.layers.declareAnonymous(layer);
        parseRuleList(src, i + 1, end - 1, inner, ctx, rules, state);
      } else if (name === 'container') {
        const outer = state.containers;
        state.containers = [...(outer ?? []), at[2]];
        parseRuleList(src, i + 1, end - 1, layer, ctx, rules, state);
        state.containers = outer;
      } else if (conditionHolds(name, at[2], ctx)) {
        parseRuleList(src, i + 1, end - 1, layer, ctx, rules, state);
      }
    } else if (prelude) {
      const declarations = parseDeclarations(src.slice(i + 1, end - 1));
      for (const raw of splitTopLevel(prelude, ',')) {
        const selector = raw.trim();
        if (selector) {
          const { containers } = state;
          rules.push({
            selector, declarations, specificity: specificity(selector), order: state.order++, layer,
            ...(containers ? { containers } : {}),
          });
        }
      }
    }
    i = end;
    preludeStart = end;
  }
}

function conditionHolds(name: string, condition: string, ctx: StylesheetContext): boolean {
  if (name === 'media') return evaluateMediaQuery(condition, ctx.media ?? DEFAULT_MEDIA_ENVIRONMENT);
  if (name === 'supports') return evaluateSupports(condition, { selector: ctx.selector });
  return false;
}
