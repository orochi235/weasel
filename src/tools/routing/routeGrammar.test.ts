import { describe, it, expect } from 'vitest';
import { parseRoute, type ParsedRoute } from './routeGrammar';

describe('parseRoute v3', () => {
  // ---- Basic shape ----

  it('parses a click with empty target and one modifier', () => {
    expect(parseRoute('[initial] click => empty +shift')).toEqual({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { shift: 'required' },
    } satisfies ParsedRoute);
  });

  it('parses an optional modifier', () => {
    expect(parseRoute('[initial] keyDown(ArrowDown) ?shift')).toEqual({
      phases: ['initial'], gesture: 'keyDown', arg: 'ArrowDown',
      target: undefined, modifiers: { shift: 'optional' },
    });
  });

  it('parses multiple modifier atoms', () => {
    expect(parseRoute('[initial] click => empty +mod ?shift')).toEqual({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { mod: 'required', shift: 'optional' },
    });
  });

  it('parses a phase list', () => {
    expect(parseRoute('[initial,engaged] contextMenu => empty')).toEqual({
      phases: ['initial', 'engaged'], gesture: 'contextMenu',
      arg: undefined, target: 'empty', modifiers: {},
    });
  });

  it('parses [*] as the wildcard phase', () => {
    expect(parseRoute('[*] click => empty')).toEqual({
      phases: ['*'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: {},
    });
  });

  // ---- Wildcards & elision ----

  it('omitted targetSlot resolves to "*" for hasTarget gestures', () => {
    expect(parseRoute('[initial] click')).toEqual({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: '*', modifiers: {},
    });
  });

  it('explicit "=> *" parses to the same shape as omitted target', () => {
    expect(parseRoute('[initial] click => *')).toEqual(parseRoute('[initial] click'));
  });

  it('omitted argSlot resolves to descriptor default for wheel', () => {
    expect(parseRoute('[initial] wheel')).toEqual({
      phases: ['initial'], gesture: 'wheel', arg: '*',
      target: undefined, modifiers: {},
    });
  });

  it('explicit "wheel(*)" parses to the same shape as omitted arg', () => {
    expect(parseRoute('[initial] wheel(*)')).toEqual(parseRoute('[initial] wheel'));
  });

  it('targetless gesture (wheel) accepts modifiers without a target', () => {
    expect(parseRoute('[initial] wheel(up) +mod')).toEqual({
      phases: ['initial'], gesture: 'wheel', arg: 'up',
      target: undefined, modifiers: { mod: 'required' },
    });
  });

  // ---- Whitespace tolerance ----

  it('accepts arbitrary whitespace between tokens', () => {
    const canonical = '[initial] click => empty +shift';
    const messy    = '[ initial ]   click   =>   empty   +shift';
    expect(parseRoute(messy)).toEqual(parseRoute(canonical));
  });

  it('accepts whitespace in phase list', () => {
    expect(parseRoute('[ initial , engaged ] click')).toEqual(
      parseRoute('[initial,engaged] click'),
    );
  });

  it('preserves whitespace inside argSlot', () => {
    expect(parseRoute('[initial] keyDown( )')).toEqual({
      phases: ['initial'], gesture: 'keyDown', arg: ' ',
      target: undefined, modifiers: {},
    });
  });

  // ---- Errors ----

  it('rejects empty phase list', () => {
    expect(() => parseRoute('[] click')).toThrow(/empty phase list/i);
  });

  it('rejects missing phase brackets', () => {
    expect(() => parseRoute('initial click')).toThrow(/phase.*bracket/i);
  });

  it('rejects unknown gesture name', () => {
    expect(() => parseRoute('[initial] bogus => empty')).toThrow(/unknown gesture/i);
  });

  it('rejects target slot on a no-target gesture', () => {
    expect(() => parseRoute('[initial] wheel(up) => foo')).toThrow(/wheel.*no target/i);
  });

  it('rejects arg slot on a no-arg gesture', () => {
    expect(() => parseRoute('[initial] click(foo) => empty')).toThrow(/click.*no arg/i);
  });

  it('rejects unknown enum arg value', () => {
    expect(() => parseRoute('[initial] wheel(sideways)')).toThrow(/sideways.*up.*down/i);
  });

  it('rejects unknown modifier name', () => {
    expect(() => parseRoute('[initial] click => empty +bogus')).toThrow(/unknown modifier/i);
  });

  it('rejects duplicate modifier in modSlot', () => {
    expect(() => parseRoute('[initial] click => empty +shift ?shift')).toThrow(/duplicate modifier/i);
    expect(() => parseRoute('[initial] click => empty +shift +shift')).toThrow(/duplicate modifier/i);
  });

  it('rejects each reserved sigil', () => {
    for (const sigil of ['!', '@', '#', '$', '%', '^', '&']) {
      expect(() => parseRoute(`[initial] click => empty ${sigil}shift`))
        .toThrow(/reserved/i);
    }
  });

  it('rejects unbalanced argSlot parens', () => {
    expect(() => parseRoute('[initial] keyDown(ArrowDown')).toThrow(/unbalanced|paren/i);
  });
});
