import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const less = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Trial.less'), 'utf8');

/** The body of one rule, by selector. Resolves Less's `&__suffix` nesting and
 *  matches braces, so a nested block cannot end the slice early. */
function rule(selector: string): string {
  const nested = selector.replace(/^\.[a-z-]+?(__|--)/, '&$1');
  const start = [selector, nested].map((s) => less.indexOf(`${s} {`)).find((i) => i !== -1);
  if (start === undefined) throw new Error(`no rule for ${selector}`);
  const open = less.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < less.length; i += 1) {
    if (less[i] === '{') depth += 1;
    else if (less[i] === '}') {
      depth -= 1;
      if (depth === 0) return less.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated rule for ${selector}`);
}

describe('trial chrome seams', () => {
  // A `not.toMatch` passes on an empty string, so pin that `rule()` found the
  // rule it was asked for.
  it('isolates the rule it is asked for', () => {
    expect(rule('.lk-trial__toolbar')).toMatch(/flex-shrink/);
    expect(rule('.lk-trial__status')).toMatch(/flex-shrink/);
  });

  it('lets the component draw its own border, not the wrapper', () => {
    expect(rule('.lk-trial__toolbar')).not.toMatch(/border-bottom:\s*[^;]*solid/);
    expect(rule('.lk-trial__status')).not.toMatch(/border-top:\s*[^;]*solid/);
  });
});
