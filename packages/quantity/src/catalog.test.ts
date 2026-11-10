import { describe, expect, it } from 'vitest';
import { catalogUnit, catalogUnits, registerUnit, unitSpellings, unitSymbol } from './catalog';
import { speakUnit, unit } from './kinds/measure';
import { parseNumber } from './number';
import { present } from './present';

describe('unit catalog lookup', () => {
  it('finds a unit by its name, its symbol, its compact form, or an alias', () => {
    for (const text of ['inch', 'in', '″', '"', '”']) expect(catalogUnit(text)?.name).toBe('inch');
    expect(catalogUnit('deg')?.name).toBe('degree');
    expect(catalogUnit('°')?.name).toBe('degree');
  });

  it('tells case apart', () => {
    expect(catalogUnit('m')?.name).toBe('meter');
    expect(catalogUnit('M')).toBeUndefined();
  });

  it('knows nothing of text no unit is written as', () => {
    expect(catalogUnit('furlong')).toBeUndefined();
    expect(catalogUnit('constructor')).toBeUndefined();
  });
});

describe('unitSymbol', () => {
  it('writes a name or a symbol alias as the symbol', () => {
    expect(unitSymbol('inch').text).toBe('in');
    expect(unitSymbol('deg').text).toBe('°');
  });

  it('gives the compact form when asked, and the symbol for a unit with none', () => {
    expect(unitSymbol('in', { compact: true }).text).toBe('″');
    expect(unitSymbol('ft', { compact: true }).text).toBe('′');
    expect(unitSymbol('mm', { compact: true }).text).toBe('mm');
  });

  it('keeps the compact form for its own text and its aliases', () => {
    expect(unitSymbol('″').text).toBe('″');
    expect(unitSymbol('"').text).toBe('″');
    expect(unitSymbol("'").text).toBe('′');
  });

  it('says which forms attach to the number', () => {
    expect(unitSymbol('°').attaches).toBe(true);
    expect(unitSymbol('%').attaches).toBe(true);
    expect(unitSymbol('in', { compact: true }).attaches).toBe(true);
    expect(unitSymbol('in').attaches).toBe(false);
    expect(unitSymbol('px').attaches).toBe(false);
  });

  it('writes unknown text as given, unattached', () => {
    expect(unitSymbol('nodes')).toEqual({ text: 'nodes', attaches: false, aliases: [] });
  });
});

describe('spellings', () => {
  it('lists every form and alias, the name aside', () => {
    expect(unitSpellings('in')).toEqual(['in', '″', '"', '”']);
    expect(unitSpellings('nodes')).toEqual(['nodes']);
  });

  it('reads any spelling where a table accepts one', () => {
    expect(parseNumber('3°', { deg: 1 })).toBe(3);
    expect(parseNumber('2″', { in: 1, ft: 12 })).toBe(2);
    expect(parseNumber('5’ 3”', { in: 1, ft: 12 })).toBe(63);
  });
});

describe('speech', () => {
  it('speaks through Intl where the unit has an Intl name', () => {
    expect(speakUnit(2, '″', 'en-US')).toBe('2 inches');
    expect(speakUnit(1, 'deg', 'en-US')).toBe('1 degree');
  });

  it('speaks its own names where Intl has none, and its symbol where it has neither', () => {
    expect(speakUnit(1, 'px', 'en-US')).toBe('1 pixel');
    expect(speakUnit(2, 'rad', 'en-US')).toBe('2 radians');
    expect(speakUnit(2, 'em', 'en-US')).toBe('2 em');
  });

  it('picks the plural by the number as it reads', () => {
    expect(speakUnit(1.001, 'px', 'en-US')).toBe('1 pixel');
  });
});

describe('registerUnit', () => {
  it('adds a unit every display and table reads, and takes it back out', () => {
    const release = registerUnit({ name: 'furlong', symbol: 'fur', compact: { text: 'ƒ', attaches: true }, spoken: ['furlong', 'furlongs'] });
    try {
      expect(catalogUnit('furlong')?.symbol.text).toBe('fur');
      expect(present(2, unit('furlong', { compact: true })).text).toBe('2ƒ');
      expect(present(2, unit('fur')).spoken).toBe('2 furlongs');
      expect(parseNumber('3ƒ', { fur: 1 })).toBe(3);
      expect(catalogUnits().some((u) => u.name === 'furlong')).toBe(true);
    } finally {
      release();
    }
    expect(catalogUnit('furlong')).toBeUndefined();
  });

  it('shadows a built-in at the keys it shares until released', () => {
    const release = registerUnit({ name: 'degree', symbol: { text: 'deg', aliases: ['°'] }, intl: 'degree' });
    try {
      expect(unitSymbol('°').text).toBe('deg');
      expect(catalogUnits().filter((u) => u.name === 'degree')).toHaveLength(1);
    } finally {
      release();
    }
    expect(unitSymbol('deg').text).toBe('°');
  });
});
