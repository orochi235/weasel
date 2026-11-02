import { describe, expect, it } from 'vitest';
import { TBD_REST_KEY, dropUnlisted, joinLocus, locusSelectors, memberAt, repairLocus, weighLocus, writeMember, type TbdClosedLists } from './locus';
import { tbdPerClosed, tbdPerDefault } from './per';
import type { PrefLeaf } from './schema';

const MODE = 'mode';
const LAYOUT = 'layout';
const locus = (by: string, own: Record<string, unknown>, shared?: unknown) =>
  (shared === undefined ? { $by: by, $in: own } : { $by: by, $in: own, [TBD_REST_KEY]: shared });
const closed = (by: string, options: string[], proposed: Record<string, unknown> = {}): TbdClosedLists => ({ [by]: { options, proposed } });

describe('a closed selector', () => {
  const list = closed(MODE, ['types']);
  const held = locus(MODE, { types: 0 }, 300000);

  it('reads an option it names from its own member, and every other from the shared one', () => {
    expect(memberAt(held, { [MODE]: 'types' }, -1, list)).toBe(0);
    expect(memberAt(held, { [MODE]: 'dark' }, -1, list)).toBe(300000);
    expect(memberAt(locus(MODE, { types: 0 }), { [MODE]: 'dark' }, -1, list)).toBe(-1);
  });

  it('reads an option it names but holds nothing for as its proposed value, else the shared member', () => {
    expect(memberAt(locus(MODE, {}, 9), { [MODE]: 'types' }, -1, closed(MODE, ['types'], { types: 0 }))).toBe(0);
    expect(memberAt(locus(MODE, {}, 9), { [MODE]: 'types' }, -1, list)).toBe(9);
    expect(memberAt(locus(MODE, {}), { [MODE]: 'types' }, -1, list)).toBe(-1);
  });

  it('writes where it reads, and a named option written keeps its own', () => {
    expect(writeMember(held, { [MODE]: 'light' }, 5, list)).toEqual(locus(MODE, { types: 0 }, 5));
    expect(writeMember(locus(MODE, {}, 1), { [MODE]: 'types' }, 5, list)).toEqual(locus(MODE, { types: 5 }, 1));
  });

  it('ignores a member of an option it no longer names, and drops it', () => {
    const stale = locus(MODE, { types: 1, dark: 2 }, 3);
    expect(memberAt(stale, { [MODE]: 'dark' }, -1, list)).toBe(3);
    expect(repairLocus(stale, [MODE], () => ['dark', 'light', 'types'], (v) => v, list)).toEqual(locus(MODE, { types: 1 }, 3));
    expect(dropUnlisted(stale, list)).toEqual(locus(MODE, { types: 1 }, 3));
    expect(dropUnlisted(held, list)).toBe(held);
  });

  it('weighs the shared member once per option that reads it, and joins to what the selection reads', () => {
    expect(weighLocus(held, { [MODE]: { types: 0.5, dark: 0.5 } }, -1, list)).toEqual([{ value: 0, weight: 0.5 }, { value: 300000, weight: 0.5 }]);
    expect(joinLocus(held, MODE, { [MODE]: 'dark' }, -1, list)).toBe(300000);
  });
});

describe('an open selector', () => {
  it('reads an option its own member once it has one, and the shared one until then', () => {
    const held = locus('document', { a: 7 }, 1);
    expect(memberAt(held, { document: 'a' }, -1)).toBe(7);
    expect(memberAt(held, { document: 'b' }, -1)).toBe(1);
    expect(memberAt(locus('document', { a: 7 }), { document: 'b' }, -1)).toBe(-1);
  });

  it('gives an option written a member of its own, and with no option named writes the shared one', () => {
    const held = locus('document', {}, 1);
    expect(writeMember(held, { document: 'b' }, 2)).toEqual(locus('document', { b: 2 }, 1));
    expect(writeMember(held, {}, 2)).toEqual(locus('document', {}, 2));
  });

  it('reads the shared member where no option is named or weighed', () => {
    const held = locus('document', { a: 7 }, 1);
    expect(memberAt(held, {}, -1)).toBe(1);
    expect(weighLocus(held, {}, -1)).toEqual([{ value: 1, weight: 1 }]);
  });
});

describe('nested entries', () => {
  const lists = { ...closed(MODE, ['types']), ...closed(LAYOUT, ['explorer']) };
  const held = locus(MODE, { types: 2 }, locus(LAYOUT, { explorer: 0.3 }, 1.1));

  it('stop at an outer own member, and go on through the shared one', () => {
    expect(memberAt(held, { [MODE]: 'types', [LAYOUT]: 'explorer' }, -1, lists)).toBe(2);
    expect(memberAt(held, { [MODE]: 'dark', [LAYOUT]: 'explorer' }, -1, lists)).toBe(0.3);
    expect(memberAt(held, { [MODE]: 'dark', [LAYOUT]: 'grid' }, -1, lists)).toBe(1.1);
    expect(memberAt(held, { [MODE]: 'dark' }, -1, lists)).toBe(1.1);
    expect([...locusSelectors(held)]).toEqual([MODE, LAYOUT]);
  });

  it('write into the inner entry through the shared member, and drop stale members at any depth', () => {
    expect(writeMember(held, { [MODE]: 'dark', [LAYOUT]: 'explorer' }, 0.5, lists))
      .toEqual(locus(MODE, { types: 2 }, locus(LAYOUT, { explorer: 0.5 }, 1.1)));
    expect(dropUnlisted(locus(MODE, { types: 2 }, locus(LAYOUT, { explorer: 0.3, grid: 4 }, 1.1)), lists)).toEqual(held);
  });
});

describe('a leaf with per', () => {
  const leaf = {
    kind: 'number', name: 'Limit', description: '', default: 1.1,
    per: [{ selector: MODE, overrides: { types: 2 } }, { selector: LAYOUT, overrides: ['explorer'] }, { selector: 'document' }],
  } as PrefLeaf;

  it('defaults to an empty locus per entry, nested outermost first', () => {
    expect(tbdPerDefault(leaf)).toEqual(locus(MODE, {}, locus(LAYOUT, {}, locus('document', {}))));
  });

  it('closes a selector given overrides, by option names or by proposed values, and leaves the rest open', () => {
    expect(tbdPerClosed(leaf)).toEqual({
      [MODE]: { options: ['types'], proposed: { types: 2 } },
      [LAYOUT]: { options: ['explorer'], proposed: {} },
    });
  });

  it('defaults to its defaultLocus where it has one, and to none with no entries', () => {
    const given = locus(MODE, { types: 9 });
    expect(tbdPerDefault({ ...leaf, defaultLocus: given } as PrefLeaf)).toBe(given);
    expect(tbdPerDefault({ kind: 'number', name: 'N', description: '', default: 1 } as PrefLeaf)).toBeUndefined();
  });
});
