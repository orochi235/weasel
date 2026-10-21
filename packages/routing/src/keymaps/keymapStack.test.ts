import { describe, it, expect, vi } from 'vitest';
import { createKeymapStack } from './keymapStack';

const ids = (s: ReturnType<typeof createKeymapStack>) => s.open().map((k) => k.id);

describe('createKeymapStack', () => {
  it('a tapped leader leaves its keymap open for one input', () => {
    const s = createKeymapStack();
    s.batch(() => s.push('loupe', 'Loupe', { heldBy: 'g1' }));
    s.release('g1');
    expect(ids(s)).toEqual(['loupe']);
    expect(s.innermost()?.heldBy).toBeUndefined();
    s.batch(() => s.inputSeen());
    expect(ids(s)).toEqual([]);
  });

  it('a held leader keeps its keymap open through input, and its release closes it', () => {
    const s = createKeymapStack();
    s.batch(() => s.push('loupe', 'Loupe', { heldBy: 'g1' }));
    s.batch(() => s.inputSeen());
    s.batch(() => s.inputSeen());
    expect(ids(s)).toEqual(['loupe']);
    s.release('g1');
    expect(ids(s)).toEqual([]);
  });

  it('defers closes to the end of the input', () => {
    const s = createKeymapStack();
    s.push('loupe', 'Loupe');
    s.batch(() => {
      s.inputSeen();
      expect(ids(s)).toEqual(['loupe']);
      expect(s.verdict()).toBe('taken');
    });
    expect(ids(s)).toEqual([]);
    expect(s.verdict()).toBeNull();
  });

  it('does not let the input that opened a level close it', () => {
    const s = createKeymapStack();
    s.push('outer', 'Outer');
    s.batch(() => {
      s.push('inner', 'Inner', { heldBy: 'g2' });
      s.inputSeen();
    });
    expect(ids(s)).toEqual(['outer', 'inner']);
  });

  it('closes once-levels down to the innermost held one', () => {
    const s = createKeymapStack();
    s.push('outer', 'Outer', { heldBy: 'g1' });
    s.push('inner', 'Inner');
    s.batch(() => s.inputSeen());
    expect(ids(s)).toEqual(['outer']);
  });

  it('releasing a held level closes the levels above it', () => {
    const s = createKeymapStack();
    s.push('outer', 'Outer', { heldBy: 'g1' });
    s.batch(() => s.inputSeen());
    s.push('inner', 'Inner');
    s.release('g1');
    expect(ids(s)).toEqual([]);
  });

  it('Escape closes one level', () => {
    const s = createKeymapStack();
    s.push('outer', 'Outer');
    s.push('inner', 'Inner');
    s.batch(() => s.closeInnermost());
    expect(ids(s)).toEqual(['outer']);
  });

  it('closeAll empties the stack and notifies once', () => {
    const s = createKeymapStack();
    s.push('a', 'A');
    s.push('b', 'B', { heldBy: 'g1' });
    const fn = vi.fn();
    s.subscribe(fn);
    s.closeAll();
    expect(ids(s)).toEqual([]);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('bumps its version on every change', () => {
    const s = createKeymapStack();
    const v0 = s.getVersion();
    s.push('a', 'A');
    expect(s.getVersion()).toBeGreaterThan(v0);
  });

  it('remembers a cascade for the rest of the input', () => {
    const s = createKeymapStack();
    s.push('a', 'A');
    s.batch(() => {
      s.cascaded();
      expect(s.verdict()).toBe('cascaded');
    });
    expect(ids(s)).toEqual([]);
  });
});
