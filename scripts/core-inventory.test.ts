import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectInventory, diffInventory, formatInventory, INVENTORY, type Inventory } from './core-inventory.mjs';

const recorded = JSON.parse(readFileSync(INVENTORY, 'utf8')) as Inventory;

describe('core exports inventory', () => {
  const actual = collectInventory();

  it('lists every public export of every entry point, and nothing else', () => {
    expect(
      diffInventory(recorded, actual),
      'core\'s exports differ from packages/core/exports.inventory.json; run `npm run inventory:core -- --update` if intended',
    ).toEqual([]);
  });

  it('is written sorted, as --update writes it', () => {
    expect(readFileSync(INVENTORY, 'utf8')).toBe(formatInventory(actual));
  });

  it.each(Object.keys(recorded))('records the runtime exports of %s as its values', async (subpath) => {
    const mod = (await import(subpath === '.' ? '@weasel-js/core' : `@weasel-js/core/${subpath.slice(2)}`)) as object;
    const values = Object.entries(recorded[subpath]).filter(([, kind]) => kind !== 'type').map(([name]) => name);
    expect(Object.keys(mod).sort()).toEqual(values.sort());
  }, 60_000);
});

describe('diffInventory', () => {
  it('names what was added, removed, and reclassified', () => {
    expect(
      diffInventory({ '.': { a: 'const', b: 'type' }, './x': { c: 'function' } }, { '.': { a: 'function', d: 'type' } }),
    ).toEqual([
      '~ @weasel-js/core a (const -> function)',
      '- @weasel-js/core b (type)',
      '+ @weasel-js/core d (type)',
      '- @weasel-js/core/x c (function)',
    ]);
  });
});
