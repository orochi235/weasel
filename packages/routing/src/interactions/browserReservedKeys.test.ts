import { describe, expect, it } from 'vitest';
import { browserReservedChord } from './browserReservedKeys';

describe('browserReservedChord', () => {
  it.each(['i', 'j', 'c'])('takes Ctrl+Shift+%s, the devtools chords of Chrome on Windows and Linux', (key) => {
    expect(browserReservedChord({ kind: 'key', key, mods: { ctrl: true, shift: true } })).not.toBeNull();
    expect(browserReservedChord({ kind: 'key', key, mods: { mod: true, shift: true } })).not.toBeNull();
  });

  it.each(['j', 'k'])('takes Mod+Shift+%s, the consoles of Firefox', (key) => {
    expect(browserReservedChord({ kind: 'key', key, mods: { mod: true, shift: true } })).not.toBeNull();
  });

  it('leaves Alt+J and Mod+Alt+Shift+J free', () => {
    expect(browserReservedChord({ kind: 'key', key: 'j', mods: { alt: true } })).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'j', mods: { mod: true, alt: true, shift: true } })).toBeNull();
  });

  it('reads Ctrl and Meta beside mod as the matcher does, so it names the chord that fires', () => {
    // Cmd+Ctrl+Q on a Mac and Ctrl+Win+Q elsewhere: neither is quit.
    expect(browserReservedChord({ kind: 'key', key: 'q', mods: { mod: true, ctrl: true } }, true)).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'q', mods: { mod: true, meta: true } }, false)).toBeNull();
    // Ctrl+Q on a Mac is no Cmd chord; Cmd beside mod on a Mac is the one key.
    expect(browserReservedChord({ kind: 'key', key: 'q', mods: { ctrl: true } }, true)).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'q', mods: { mod: true, meta: true } }, true)?.key).toBe('q');
    expect(browserReservedChord({ kind: 'key', key: 'q', mods: { meta: true } }, true)?.key).toBe('q');
    expect(browserReservedChord({ kind: 'key', key: 'q', mods: { mod: true, meta: 'optional' } }, false)?.key).toBe('q');
  });

  it('takes Ctrl+Escape off a Mac, the Windows Start menu, and leaves Cmd+Escape on a Mac', () => {
    expect(browserReservedChord({ kind: 'key', key: 'Escape', mods: { ctrl: true } }, false)?.use).toMatch(/Start menu/);
    expect(browserReservedChord({ kind: 'key', key: 'Escape', mods: { mod: true } }, false)).not.toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'Escape', mods: { mod: true } }, true)).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'Escape', mods: { meta: true } }, true)).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'Escape' }, false)).toBeNull();
  });
});
