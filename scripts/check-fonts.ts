/**
 * A font family comes from the cascade. A component that sets one replaces whatever its consumer's
 * container chose, so a stylesheet may set `font-family` (or the `font` shorthand's family) only:
 *
 *   - to `inherit`, which hands a control back the family the user agent took from it;
 *   - to a role token, read through `var()`: the mono face (code, ids, readouts), the display face
 *     (headings), a title font, or the numeric face (owned by `check:numeric`). A consumer retargets a
 *     role by setting its token, so the choice stays theirs;
 *   - on a theme root (`:root`, `html`, `body`, `:host`), or a rule `ALLOWED` names with its reason: a
 *     page's root or a documented exception. Only there may the base faces (`--wzl-font-ui`,
 *     `--wzl-font-body`) or a family written out be set.
 *
 * A custom property whose name ends in `-font` is a family too and is held to the same rule.
 * An app has no consumer, so any rule in `apps/` may set a base face; a family written out still goes
 * through a token there.
 * A custom property may also be `initial`, which leaves whatever reads it to the cascade.
 * Story stylesheets are the consumer, and `/Foundations/` is the token showcase, so neither is checked.
 * docs/conventions.md ("Font families") states the rule.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blocks, lineAt, stripComments, walk } from './lib/cssBlocks.ts';

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly why: string;
}

/**
 * Rules other than the document's roots that may set any family, by file and then selector, each with
 * its reason: a page's own root, or a component's documented exception.
 */
export const ALLOWED: Record<string, Record<string, string>> = {
  'packages/labkit/src/theme/base.less': { '.lk-root': "a lab's page root" },
  'packages/theme/src/fonts.css': { ':where([data-wzl-theme])': "a themed subtree's root, in the kit's opt-in typography" },
  'packages/forge/src/frame/index/index.css': {
    '.fg-index': "the root of forge's index page",
    '.fg-index__description': 'the index page sets its prose in the body face',
    '.fg-index-story__description': 'the index page sets its prose in the body face',
  },
  'packages/forge/src/frame/frame.css': { '.fg-frame__fault': "a story's fault, drawn whether or not a theme loaded" },
  'apps/site/FrontPage/Wordmark.module.css': { '.wordmark': "the logo's own face" },
  'apps/site/demos/CompoundPathsDemo.module.css': { '.story': 'the demo sets text in a face unlike the page, to show it carried into the paths' },
  'packages/ui/src/components/Keycaps/Keycaps.module.css': {
    '.key': 'a key legend reads in a neutral sans, not the UI face; `KeyCap` takes a `font` to change it',
  },
};

const DOC_ROOT = /^(?::root|html|body|:host|#root)(?:\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?)*$/;
/** `--_s-unset` is never declared: a stance slot falling back to it is left to the cascade. */
const ROLE = /^--(?:wzl-font-(?:mono|display|numeric)|[\w-]*title-font|_s-unset)$/;
const BASE = /^--wzl-font-(?:ui|body)$/;
const FAMILY_DECL = /^(font-family|font|--[\w-]*-font)\s*:\s*([\s\S]*)$/;

/** The family part of a `font` shorthand: what follows the size, or the whole of a single keyword or var. */
function shorthandFamily(value: string): string | null {
  if (/^(inherit|initial|unset|revert|revert-layer)$/.test(value)) return value;
  if (/^var\([^,()]*\)$/.test(value)) return null; // a whole-shorthand token says nothing about the family alone
  if (/^(caption|icon|menu|message-box|small-caption|status-bar)$/.test(value)) return value;
  const size = /(?:^|\s)(?:[\d.]+(?:px|r?em|%|pt|ch|ex|vw|vh)|var\([^()]*(?:\([^()]*\))*[^()]*\)|calc\([^()]*\)|xx-small|x-small|small|medium|large|x-large|xx-large|larger|smaller)(?:\s*\/\s*(?:[\d.]+\w*%?|var\([^()]*(?:\([^()]*\))*[^()]*\)|normal))?\s+/g;
  let last: RegExpExecArray | null = null;
  for (let m = size.exec(value); m; m = size.exec(value)) last = m;
  return last ? value.slice(last.index + last[0].length).trim() : value;
}

/** Whether `family` is allowed outside a root: `inherit`, or role tokens read through `var()`. */
export function isRoleFamily(family: string): boolean {
  if (family === 'inherit') return true;
  const names = [...family.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!);
  return family.startsWith('var(') && names.every((n) => ROLE.test(n));
}

/** Role tokens or the base faces, read through `var()`. */
const isAppFamily = (family: string) =>
  family.startsWith('var(') && [...family.matchAll(/var\(\s*(--[\w-]+)/g)].every((m) => ROLE.test(m[1]!) || BASE.test(m[1]!));

const isAllowed = (file: string, selectors: readonly string[]) => {
  const own = selectors[selectors.length - 1] ?? '';
  return own.split(',').map((s) => s.trim()).every((s) => DOC_ROOT.test(s) || Object.hasOwn(ALLOWED[file] ?? {}, s));
};

export function offenders(file: string, source: string): Offender[] {
  const clean = stripComments(source);
  const out: Offender[] = [];
  for (const { selectors, decls } of blocks(clean)) {
    if (selectors.some((s) => s.startsWith('@font-face'))) continue;
    if (isAllowed(file, selectors)) continue;
    for (const { text, index } of decls) {
      const m = FAMILY_DECL.exec(text);
      if (!m) continue;
      const value = m[2]!.replace(/\s*!important$/, '').trim();
      const family = m[1] === 'font' ? shorthandFamily(value) : value;
      // On a custom property, `initial` is the guaranteed-invalid value: whatever reads it inherits.
      if (family === null || isRoleFamily(family) || (m[1]!.startsWith('--') && family === 'initial')) continue;
      if (file.startsWith('apps/') && isAppFamily(family)) continue;
      out.push({
        file,
        line: lineAt(clean, index),
        text: text.replace(/\s+/g, ' '),
        why: /var\(\s*--wzl-font-(?:ui|body)\b/.test(family)
          ? 'resets the family its container chose; leave it to inherit'
          : 'sets a family outside a root; inherit it, or read a role token (--wzl-font-mono, --wzl-font-display)',
      });
    }
  }
  return out;
}

export const isChecked = (p: string) =>
  /\.(css|less)$/.test(p) && !/\.(stories|story)\./.test(p) && !p.includes('/Foundations/');

if (process.argv[1]?.endsWith('check-fonts.ts')) {
  const root = join(import.meta.dirname, '..');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))].map((p) => relative(root, p)).filter(isChecked);
  const bad = files.flatMap((p) => offenders(p, readFileSync(join(root, p), 'utf8')));
  for (const o of bad) console.error(`${o.file}:${o.line}  ${o.why}  ${o.text}`);
  console.log(`${files.length} stylesheets, ${bad.length} font-family offender(s)`);
  process.exit(bad.length === 0 ? 0 : 1);
}
