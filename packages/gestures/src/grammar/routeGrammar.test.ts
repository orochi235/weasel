import { describe, it, expect } from 'vitest';
import {
  parseRoute, formatRoute, formatPhaseAtom, collapseShiftPairs,
  type ParsedRoute, type PhaseAtom,
} from './routeGrammar';

/** Shorthand for bare-channel phase atoms in test fixtures. */
const self = (p: PhaseAtom['phase']): PhaseAtom => ({ channel: '&', phase: p });

describe('parseRoute v3', () => {
  // ---- Basic shape ----

  it('parses a click with empty target and one modifier', () => {
    expect(parseRoute('[initial] click => empty +shift')).toEqual({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { shift: 'required' },
    } satisfies ParsedRoute);
  });

  it('parses an optional modifier', () => {
    expect(parseRoute('[initial] keyDown(ArrowDown) ?shift')).toEqual({
      phases: [self('initial')], gesture: 'keyDown', arg: 'ArrowDown',
      target: undefined, modifiers: { shift: 'optional' },
    });
  });

  it('parses keyHeld with a key arg', () => {
    expect(parseRoute('[initial] keyHeld(Space)')).toEqual({
      phases: [self('initial')], gesture: 'keyHeld', arg: 'Space',
      target: undefined, modifiers: {},
    });
  });

  it('parses multiple modifier atoms', () => {
    expect(parseRoute('[initial] click => empty +mod ?shift')).toEqual({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { mod: 'required', shift: 'optional' },
    });
  });

  it('parses a phase list', () => {
    expect(parseRoute('[initial,engaged] contextMenu => empty')).toEqual({
      phases: [self('initial'), self('engaged')], gesture: 'contextMenu',
      arg: undefined, target: 'empty', modifiers: {},
    });
  });

  it('parses [*] as bare-channel wildcard phase', () => {
    expect(parseRoute('[*] click => empty')).toEqual({
      phases: [self('*')], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: {},
    });
  });

  // ---- Channel forms ----

  it('parses explicit & channel', () => {
    expect(parseRoute('[&:engaged] wheel').phases).toEqual([self('engaged')]);
  });

  it('parses named tool channel', () => {
    expect(parseRoute('[rect:engaged] wheel').phases).toEqual([
      { channel: 'rect', phase: 'engaged' },
    ]);
  });

  it('parses wildcard channel', () => {
    expect(parseRoute('[*:engaged] keyDown(Delete)').phases).toEqual([
      { channel: '*', phase: 'engaged' },
    ]);
  });

  it('parses fully loose channel:phase wildcard', () => {
    expect(parseRoute('[*:*] click').phases).toEqual([
      { channel: '*', phase: '*' },
    ]);
  });

  it('parses mixed phase list (bare + named channel)', () => {
    expect(parseRoute('[engaged,rect:engaged] wheel').phases).toEqual([
      self('engaged'),
      { channel: 'rect', phase: 'engaged' },
    ]);
  });

  // ---- Wildcards & elision ----

  it('omitted targetSlot resolves to "*" for hasTarget gestures', () => {
    expect(parseRoute('[initial] click')).toEqual({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: '*', modifiers: {},
    });
  });

  it('explicit "=> *" parses to the same shape as omitted target', () => {
    expect(parseRoute('[initial] click => *')).toEqual(parseRoute('[initial] click'));
  });

  it('omitted argSlot resolves to descriptor default for wheel', () => {
    expect(parseRoute('[initial] wheel')).toEqual({
      phases: [self('initial')], gesture: 'wheel', arg: '*',
      target: '*', modifiers: {},
    });
  });

  it('explicit "wheel(*)" parses to the same shape as omitted arg', () => {
    expect(parseRoute('[initial] wheel(*)')).toEqual(parseRoute('[initial] wheel'));
  });

  it('targetless gesture (keyDown) accepts modifiers without a target', () => {
    expect(parseRoute('[initial] keyDown(a) +mod')).toEqual({
      phases: [self('initial')], gesture: 'keyDown', arg: 'a',
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
      phases: [self('initial')], gesture: 'keyDown', arg: ' ',
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
    expect(() => parseRoute('[initial] keyDown(a) => foo')).toThrow(/keyDown.*no target/i);
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

  // ---- Channel-form errors ----

  it('rejects unknown phase value', () => {
    expect(() => parseRoute('[bogus] click')).toThrow(/unknown phase/i);
    expect(() => parseRoute('[rect:bogus] wheel')).toThrow(/unknown phase/i);
  });

  it('rejects empty channel before ":"', () => {
    expect(() => parseRoute('[:engaged] wheel')).toThrow(/empty channel/i);
  });

  it('rejects more than one ":" in a phase atom', () => {
    expect(() => parseRoute('[a:b:c] wheel')).toThrow(/multiple ":"/);
  });

  it('rejects channel named with a reserved phase keyword', () => {
    expect(() => parseRoute('[initial:engaged] wheel')).toThrow(/reserved phase keyword/i);
    expect(() => parseRoute('[engaged:initial] wheel')).toThrow(/reserved phase keyword/i);
  });

  it('rejects channel id starting with reserved sigil', () => {
    expect(() => parseRoute('[!foo:engaged] wheel')).toThrow(/reserved sigil/i);
    expect(() => parseRoute('[@bar:*] wheel')).toThrow(/reserved sigil/i);
  });
});

describe('formatRoute v3 (canonical form)', () => {
  it('emits one space after "]"', () => {
    expect(formatRoute({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { shift: 'required' },
    })).toBe('[initial] click => empty +shift');
  });

  it('emits two spaces around "=>"', () => {
    expect(formatRoute({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: 'selected-body', modifiers: {},
    })).toBe('[initial] click => selected-body');
  });

  it('emits space before each mod atom', () => {
    expect(formatRoute({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { mod: 'required', shift: 'optional' },
    })).toBe('[initial] click => empty +mod ?shift');
  });

  it('elides "=> *" for hasTarget gestures', () => {
    expect(formatRoute({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: '*', modifiers: {},
    })).toBe('[initial] click');
  });

  it('elides default arg for wheel', () => {
    expect(formatRoute({
      phases: [self('initial')], gesture: 'wheel', arg: '*',
      target: undefined, modifiers: {},
    })).toBe('[initial] wheel');
  });

  it('keeps explicit non-default arg', () => {
    expect(formatRoute({
      phases: [self('initial')], gesture: 'wheel', arg: 'up',
      target: undefined, modifiers: {},
    })).toBe('[initial] wheel(up)');
  });

  it('emits no spaces in phase list commas', () => {
    expect(formatRoute({
      phases: [self('initial'), self('engaged')], gesture: 'contextMenu', arg: undefined,
      target: '*', modifiers: {},
    })).toBe('[initial,engaged] contextMenu');
  });

  it('emits [*] for bare-channel wildcard phase', () => {
    expect(formatRoute({
      phases: [self('*')], gesture: 'click', arg: undefined,
      target: '*', modifiers: {},
    })).toBe('[*] click');
  });

  it('emits named channels in explicit channel:phase form', () => {
    expect(formatRoute({
      phases: [{ channel: 'rect', phase: 'engaged' }], gesture: 'wheel',
      arg: '*', target: undefined, modifiers: {},
    })).toBe('[rect:engaged] wheel');
  });

  it('emits wildcard channel in explicit form', () => {
    expect(formatRoute({
      phases: [{ channel: '*', phase: 'engaged' }], gesture: 'keyDown',
      arg: 'Delete', target: undefined, modifiers: {},
    })).toBe('[*:engaged] keyDown(Delete)');
  });

  it('emits fully-loose [*:*]', () => {
    expect(formatRoute({
      phases: [{ channel: '*', phase: '*' }], gesture: 'click',
      arg: undefined, target: '*', modifiers: {},
    })).toBe('[*:*] click');
  });

  it('canonical mod-atom order: mod, shift, alt, ctrl, meta', () => {
    expect(formatRoute({
      phases: [self('initial')], gesture: 'click', arg: undefined,
      target: 'empty',
      modifiers: { meta: 'required', alt: 'optional', shift: 'required' },
    })).toBe('[initial] click => empty +shift ?alt +meta');
  });
});

describe('formatPhaseAtom', () => {
  it('elides & channel', () => {
    expect(formatPhaseAtom(self('engaged'))).toBe('engaged');
    expect(formatPhaseAtom(self('initial'))).toBe('initial');
    expect(formatPhaseAtom(self('*'))).toBe('*');
  });
  it('keeps named channels explicit', () => {
    expect(formatPhaseAtom({ channel: 'rect', phase: 'engaged' })).toBe('rect:engaged');
    expect(formatPhaseAtom({ channel: '*', phase: 'engaged' })).toBe('*:engaged');
    expect(formatPhaseAtom({ channel: '*', phase: '*' })).toBe('*:*');
  });
});

describe('collapseShiftPairs', () => {
  it('passes singletons through unchanged', () => {
    expect(collapseShiftPairs([])).toEqual([]);
    expect(collapseShiftPairs(['[initial] keyDown(z) +mod']))
      .toEqual(['[initial] keyDown(z) +mod']);
  });

  it('folds a Cmd+] / Cmd+Shift+] pair into Cmd+?Shift+]', () => {
    const folded = collapseShiftPairs([
      '[initial] keyDown(]) +mod',
      '[initial] keyDown(]) +mod +shift',
    ]);
    expect(folded).toEqual(['[initial] keyDown(]) +mod ?shift']);
  });

  it('preserves order — keeps the first member of the fold-pair in place', () => {
    const folded = collapseShiftPairs([
      '[initial] keyDown(other) +mod',
      '[initial] keyDown(]) +mod',
      '[initial] keyDown(]) +mod +shift',
      '[initial] keyDown(third)',
    ]);
    expect(folded).toEqual([
      '[initial] keyDown(other) +mod',
      '[initial] keyDown(]) +mod ?shift',
      '[initial] keyDown(third)',
    ]);
  });

  it('does not fold pairs that differ in other modifiers (alt/ctrl/meta)', () => {
    const folded = collapseShiftPairs([
      '[initial] keyDown(z) +mod',
      '[initial] keyDown(z) +mod +alt',
    ]);
    // Different in alt, not shift — leave untouched.
    expect(folded).toHaveLength(2);
  });

  it('does not fold pairs that differ in gesture / arg / target / phase', () => {
    expect(collapseShiftPairs([
      '[initial] keyDown(a) +mod',
      '[initial] keyDown(b) +mod +shift',
    ])).toHaveLength(2);
    expect(collapseShiftPairs([
      '[initial] click => empty +mod',
      '[engaged] click => empty +mod +shift',
    ])).toHaveLength(2);
  });

  it('does not re-fold an already-optional shift', () => {
    expect(collapseShiftPairs([
      '[initial] keyDown(a) +mod ?shift',
      '[initial] keyDown(a) +mod',
    ])).toHaveLength(2);
  });
});

describe('parseRoute / formatRoute round-trip', () => {
  it('every canonical example round-trips', () => {
    const examples = [
      '[initial] click',
      '[initial] click => empty',
      '[initial] click => empty +shift',
      '[initial] click => selected-body +mod',
      '[initial] keyDown(ArrowDown) ?shift',
      '[initial] keyHeld(Space)',
      '[*:initial] keyHeld(Space) +shift',
      '[initial] wheel(up)',
      '[initial] wheel',
      '[initial,engaged] contextMenu',
      '[*] click',
      '[initial] click => empty +mod ?shift',
      // Channel-form examples (new in this revision):
      '[engaged] wheel',
      '[rect:engaged] wheel',
      '[*:engaged] keyDown(Delete)',
      '[*:*] click',
      '[engaged,rect:engaged] wheel',
    ];
    for (const r of examples) {
      expect(formatRoute(parseRoute(r))).toBe(r);
    }
  });

  it('`[&:engaged]` round-trips back to shorthand `[engaged]`', () => {
    // Source uses explicit `&:`; canonical form elides it.
    expect(formatRoute(parseRoute('[&:engaged] wheel'))).toBe('[engaged] wheel');
  });

  it('round-trips keyHeld through format → parse', () => {
    const route = '[*:initial] keyHeld(Space) +shift';
    expect(formatRoute(parseRoute(route))).toBe(route);
  });
});

describe('formatRoute idempotence', () => {
  const CANONICAL = [
    '[initial] click => empty +shift',
    '[engaged] wheel',
    '[initial] wheel(up) +mod',
    '[initial] keyDown(Delete)',
    '[initial] keyDown',
    '[*:*] drop',
    '[*:*] paste',
    '[initial] multiTouchTap',
    '[initial] multiTouchTap(3)',
    '[initial] drag => kind:app:note',
    '[initial,engaged] contextMenu',
  ];
  it.each(CANONICAL)('round-trips %s unchanged', (route) => {
    expect(formatRoute(parseRoute(route))).toBe(route);
  });
  it('elides an explicit wildcard arg', () => {
    expect(formatRoute(parseRoute('[*:*] drop(*)'))).toBe('[*:*] drop');
    expect(formatRoute(parseRoute('[engaged] wheel(*)'))).toBe('[engaged] wheel');
  });
});
