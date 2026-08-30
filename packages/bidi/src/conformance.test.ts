/**
 * The implementation against Unicode's own conformance data.
 *
 * These two files are the reason the rules above are worth trusting: between
 * them they cover every ordering the algorithm can produce, including the
 * overflow and isolate cases no handwritten test would think to construct.
 * A failure here is a real defect, never a disagreement about interpretation.
 */

import { describe, it, expect } from 'vitest';
import { resolveLevels } from './resolve';
import { reorderLine } from './reorder';
import { bidiClassOf } from './tables';
import type { BidiClass } from './types';
import {
  loadBidiCharacterTest, loadBidiTest, AUTO_LTR, LTR, RTL,
} from './__fixtures__/parseConformance';

type Dir = 'ltr' | 'rtl' | 'auto';

/** First few failures only: 490k cases can fail in bulk from one bad rule. */
function report(failures: string[], total: number): void {
  if (failures.length === 0) return;
  const shown = failures.slice(0, 10).join('\n');
  throw new Error(
    `${failures.length} of ${total} conformance cases failed. First 10:\n${shown}`,
  );
}

describe('BidiCharacterTest.txt', () => {
  const cases = loadBidiCharacterTest();

  it('parses the whole file', () => {
    expect(cases.length).toBeGreaterThan(90_000);
  });

  it('resolves the paragraph level every case expects', () => {
    const failures: string[] = [];
    for (const [n, c] of cases.entries()) {
      const dir: Dir = c.direction === 0 ? 'ltr' : c.direction === 1 ? 'rtl' : 'auto';
      const classes = c.codePoints.map(bidiClassOf);
      const got = resolveLevels(classes, dir, c.codePoints).paragraphLevel;
      if (got !== c.paragraphLevel) {
        failures.push(`#${n}: paragraph level ${got}, expected ${c.paragraphLevel}`);
      }
    }
    report(failures, cases.length);
  });

  it('resolves the level of every character', () => {
    const failures: string[] = [];
    for (const [n, c] of cases.entries()) {
      const dir: Dir = c.direction === 0 ? 'ltr' : c.direction === 1 ? 'rtl' : 'auto';
      const classes = c.codePoints.map(bidiClassOf);
      const resolved = resolveLevels(classes, dir, c.codePoints);
      const { levels } = reorderLine(classes, resolved, 0, classes.length);
      for (let i = 0; i < c.levels.length; i++) {
        const want = c.levels[i];
        const got = levels[i] === -1 ? null : levels[i];
        if (want !== got) {
          failures.push(`#${n} char ${i}: level ${got}, expected ${want}`);
          break;
        }
      }
    }
    report(failures, cases.length);
  });

  it('puts every character in the visual order the file expects', () => {
    const failures: string[] = [];
    for (const [n, c] of cases.entries()) {
      const dir: Dir = c.direction === 0 ? 'ltr' : c.direction === 1 ? 'rtl' : 'auto';
      const classes = c.codePoints.map(bidiClassOf);
      const resolved = resolveLevels(classes, dir, c.codePoints);
      const { order } = reorderLine(classes, resolved, 0, classes.length);
      if (order.join(' ') !== [...c.visualOrder].join(' ')) {
        failures.push(`#${n}: order [${order}], expected [${c.visualOrder}]`);
      }
    }
    report(failures, cases.length);
  });
});

describe('BidiTest.txt', () => {
  const cases = loadBidiTest();
  const DIRS: Array<[number, Dir]> = [[AUTO_LTR, 'auto'], [LTR, 'ltr'], [RTL, 'rtl']];

  it('parses the whole file', () => {
    expect(cases.length).toBeGreaterThan(490_000);
  });

  it('resolves levels and order for every direction each case declares', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const [n, c] of cases.entries()) {
      const classes = c.classes as BidiClass[];
      for (const [bit, dir] of DIRS) {
        if ((c.paragraphDirections & bit) === 0) continue;
        checked++;
        // No code points here — the file is expressed in classes, so N0 has
        // nothing to pair and the expectations are computed without it.
        const resolved = resolveLevels(classes, dir);
        const { levels, order } = reorderLine(classes, resolved, 0, classes.length);

        let bad = false;
        for (let i = 0; i < c.levels.length; i++) {
          const want = c.levels[i];
          const got = levels[i] === -1 ? null : levels[i];
          if (want !== got) {
            failures.push(`#${n} ${dir} char ${i}: level ${got}, expected ${want}`);
            bad = true;
            break;
          }
        }
        if (!bad && order.join(' ') !== [...c.visualOrder].join(' ')) {
          failures.push(`#${n} ${dir}: order [${order}], expected [${c.visualOrder}]`);
        }
      }
    }
    report(failures, checked);
  });
});
