import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs with no typings.
import { cssInputs, skipIfBuilt } from './build-css-inputs.mjs';

const inputs = cssInputs('/p', () => '/nm/windease/styles.css');
const sheet = '/p/labkit/dist/styles.css';
const existing =
  (...missing: string[]) =>
  (path: string) =>
    !missing.includes(path);

describe('skipIfBuilt', () => {
  it('runs when the sheet and every input are there', () => {
    expect(skipIfBuilt(inputs, sheet, existing())).toBeNull();
  });

  it('skips before labkit has a dist', () => {
    expect(skipIfBuilt(inputs, sheet, existing(sheet))).toEqual([sheet]);
  });

  // keiei's fleet tree, 2026-10-24: labkit's sheet was there, ui's dist was
  // not, and core's build died with ENOENT on ui/dist/style.css.
  it('skips when another package has not been built yet', () => {
    expect(skipIfBuilt(inputs, sheet, existing('/p/ui/dist/style.css'))).toEqual([
      '/p/ui/dist/style.css',
    ]);
  });

  it('skips when windease cannot be resolved', () => {
    const unresolved = cssInputs('/p', () => {
      throw new Error('Cannot find module');
    });
    expect(skipIfBuilt(unresolved, sheet, existing())).toEqual(['windease/styles.css']);
  });
});
