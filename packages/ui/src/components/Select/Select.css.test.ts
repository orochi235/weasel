import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The weasel-ui project's CSS-module proxy answers to any class, so these read the stylesheets themselves.
const here = dirname(fileURLToPath(import.meta.url));
const sheet = (name: string) => readFileSync(resolve(here, name), 'utf8');

/** The declarations of the rule whose selector list is exactly `selector`. */
function rule(css: string, selector: string): string {
  const at = css.search(new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm'));
  if (at < 0) throw new Error(`no rule for ${selector}`);
  const open = css.indexOf('{', at + 1);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('Select stylesheets', () => {
  it("draws a row's body and note from the listbox sheet ComboBox shares", () => {
    const select = sheet('Select.module.css');
    expect(rule(select, '.optionBody')).toMatch(/^\s*composes: optionBody from '\.\/listbox\.module\.css';\s*$/);
    expect(rule(select, '.note')).toMatch(/^\s*composes: note from '\.\/listbox\.module\.css';\s*$/);
    const listbox = sheet('listbox.module.css');
    expect(rule(listbox, '.optionBody')).toContain('min-width: 0');
    expect(rule(listbox, '.note')).toContain('display: block');
  });

});
