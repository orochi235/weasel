import { afterEach, describe, expect, it, vi } from 'vitest';
import { presentRange } from './composite';
import { percent } from './kinds/proportion';
import { decimal } from './kinds/plain';
import { parseAs, present } from './present';
import { retag, tag } from './quantity';
import { rarityTones, toneAt, withTones, type Tones } from './tones';
import { qty } from './view';

const RARITY = rarityTones();

describe('stepped tones', () => {
  it('take the last stop at or below the value, a seam belonging to the stop it starts', () => {
    expect([0, 0.1, 0.25, 0.5, 0.89, 0.9, 0.93, 1].map((v) => toneAt(RARITY, v)?.name)).toEqual([
      'common', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'legendary', 'legendary',
    ]);
    expect(toneAt(RARITY, 0.93)).toEqual({ color: '#e8820c', name: 'legendary', index: 4 });
  });

  it('clamp to the end colors past either end and at ±Infinity, and give NaN none', () => {
    expect(toneAt(RARITY, -3)?.index).toBe(0);
    expect(toneAt(RARITY, 7)?.index).toBe(4);
    expect(toneAt(RARITY, -Infinity)?.index).toBe(0);
    expect(toneAt(RARITY, Infinity)?.index).toBe(4);
    expect(toneAt(RARITY, NaN)).toBeUndefined();
    expect(toneAt({ stops: [] }, 1)).toBeUndefined();
  });

  it('place stops by value without `over`, and by fraction of it with', () => {
    const hot: Tones = { stops: [{ from: 0, data: { color: 'blue' } }, { from: 30, data: { color: 'red' } }] };
    expect(toneAt(hot, 29)?.color).toBe('blue');
    expect(toneAt(hot, 30)?.color).toBe('red');
    const over = rarityTones([0, 200]);
    expect(toneAt(over, 185)?.name).toBe('legendary');
    expect(toneAt(over, 99)?.name).toBe('uncommon');
  });
});

describe('blended tones', () => {
  const ramp: Tones = {
    blend: true,
    stops: [
      { from: 0, data: { color: '#000000', name: 'low' } },
      { from: 10, data: { color: '#ffffff', name: 'high' } },
    ],
  };

  afterEach(() => vi.restoreAllMocks());

  it('mix neighboring colors, naming the stop at or below the value', () => {
    const mid = toneAt(ramp, 5)!;
    expect(mid.name).toBe('low');
    expect(mid.index).toBe(0);
    expect(mid.color).not.toBe('#000000');
    expect(mid.color).not.toBe('#ffffff');
    expect(mid.color).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it('show a stop’s own color on it and the end colors past the ends', () => {
    expect(toneAt(ramp, 0)?.color).toBe('#000000');
    expect(toneAt(ramp, -5)?.color).toBe('#000000');
    expect(toneAt(ramp, 10)?.color).toBe('#ffffff');
    expect(toneAt(ramp, Infinity)?.color).toBe('#ffffff');
  });

  it('step, and warn once, where a color does not parse', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const vars: Tones = { blend: true, stops: [{ from: 0, data: { color: 'var(--a)' } }, { from: 1, data: { color: 'red' } }] };
    expect(toneAt(vars, 0.5)?.color).toBe('var(--a)');
    expect(toneAt(vars, 0.7)?.color).toBe('var(--a)');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('var(--a)');
  });
});

describe('a toned display', () => {
  const display = withTones(percent(), RARITY);

  it('reports the tone, marks the html with its name and no style, and speaks the name', () => {
    const plain = present(0.93, percent());
    const toned = present(0.93, display);
    expect(toned.tone).toEqual({ color: '#e8820c', name: 'legendary', index: 4 });
    expect(toned.text).toBe(plain.text);
    expect(toned.spoken).toBe('93 percent, legendary');
    expect(toned.html).toBe(plain.html.replace('<data value="0.93"', '<data value="0.93" data-tone="legendary"'));
    expect(toned.html).not.toContain('style');
  });

  it('marks an unnamed stop by its index, and keeps the name unspoken on request', () => {
    const unnamed: Tones = { stops: [{ from: 0, data: { color: 'red' } }, { from: 5, data: { color: 'blue' } }] };
    expect(present(7, withTones(decimal(), unnamed)).html).toContain('data-tone="1"');
    expect(present(7, withTones(decimal(), unnamed)).spoken).toBe('7');
    expect(present(0.93, withTones(percent(), { ...RARITY, speak: false })).spoken).toBe(present(0.93, percent()).spoken);
  });

  it('leaves typed text reading back as before', () => {
    expect(parseAs('93%', display)).toBe(parseAs('93%', percent()));
  });

  it('tones ±Infinity at the end colors', () => {
    expect(present(Infinity, display).tone?.name).toBe('legendary');
    expect(present(-Infinity, display).html).toContain('data-tone="common"');
  });

  it('survives JSON and retag', () => {
    const q = tag(0.3, display);
    const back = JSON.parse(JSON.stringify(q));
    expect(present(back).tone?.name).toBe('uncommon');
    expect(present(retag(q, 0.95)).tone?.name).toBe('legendary');
  });

  it('reaches the view and both ends of a range', () => {
    const view = qty(0.6, display);
    expect(view.tone?.name).toBe('rare');
    expect(view.html).toContain('data-tone="rare"');
    const range = presentRange(0.1, 0.95, display);
    expect(range.html).toContain('data-tone="common"');
    expect(range.html).toContain('data-tone="legendary"');
  });
});
