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
    // Cmd+Ctrl+Q on a Mac locks the screen, and Ctrl+Win+Q elsewhere is nothing: neither is quit.
    expect(browserReservedChord({ kind: 'key', key: 'q', mods: { mod: true, ctrl: true } }, true)?.use).toMatch(/lock screen/);
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

  it('reads a physical key code as the key it names, since either one fires the binding', () => {
    expect(browserReservedChord({ kind: 'key', key: 'ρ', code: 'KeyR', mods: { mod: true } })?.key).toBe('r');
    expect(browserReservedChord({ kind: 'key', key: 'x', code: ['Escape'], mods: { mod: true } }, false)?.key).toBe('escape');
    expect(browserReservedChord({ kind: 'key', key: 'ρ', code: 'KeyG', mods: { mod: true } })).toBeNull();
  });

  it.each([true, false])('takes Ctrl+Tab, Ctrl+Shift+Tab and Ctrl+PageDown, the tab switcher (apple: %s)', (apple) => {
    expect(browserReservedChord({ kind: 'key', key: 'Tab', mods: { ctrl: true } }, apple)?.use).toMatch(/tab/);
    expect(browserReservedChord({ kind: 'key', key: 'Tab', mods: { ctrl: true, shift: true } }, apple)).not.toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'PageDown', mods: { ctrl: true } }, apple)).not.toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'Tab' }, apple)).toBeNull();
  });

  it('takes Mod+Tab everywhere, the tab switcher off a Mac and the app switcher on one', () => {
    expect(browserReservedChord({ kind: 'key', key: 'Tab', mods: { mod: true } }, false)?.use).toMatch(/next/);
    expect(browserReservedChord({ kind: 'key', key: 'Tab', mods: { mod: true } }, true)?.use).toMatch(/app switcher/);
  });

  it('takes the Mac-only Cmd+Alt+arrow and Ctrl+Cmd chords only on a Mac', () => {
    expect(browserReservedChord({ kind: 'key', key: 'ArrowRight', mods: { mod: true, alt: true } }, true)).not.toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'ArrowRight', mods: { mod: true, alt: true } }, false)).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'f', mods: { mod: true, ctrl: true } }, true)?.use).toMatch(/full screen/);
  });

  it('takes Mod+1 to Mod+9, which select a tab', () => {
    for (const apple of [true, false]) {
      expect(browserReservedChord({ kind: 'key', key: '1', mods: { mod: true } }, apple)?.use).toMatch(/tab/);
      expect(browserReservedChord({ kind: 'key', key: 'x', code: 'Digit9', mods: { mod: true } }, apple)).not.toBeNull();
    }
    expect(browserReservedChord({ kind: 'key', key: '0', mods: { mod: true } })).toBeNull();
  });

  it('takes the history and tab chords: Alt+arrow off a Mac, Cmd+[ and Cmd+Shift+[ on one', () => {
    expect(browserReservedChord({ kind: 'key', key: 'ArrowLeft', mods: { alt: true } }, false)?.use).toMatch(/back/);
    expect(browserReservedChord({ kind: 'key', key: 'ArrowRight', mods: { alt: true } }, true)).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: '[', mods: { mod: true } }, true)?.use).toMatch(/back/);
    expect(browserReservedChord({ kind: 'key', key: ']', mods: { mod: true } }, false)).toBeNull();
    expect(browserReservedChord({ kind: 'key', key: '}', mods: { mod: true, shift: true } }, true)?.use).toMatch(/tab/);
  });

  it('takes the function-key and system chords: F5, F11, F12, Alt+F4, Ctrl+Shift+Esc and Ctrl+Shift+Delete', () => {
    expect(browserReservedChord({ kind: 'key', key: 'F5' })?.use).toMatch(/reload/);
    expect(browserReservedChord({ kind: 'key', key: 'F5', mods: { ctrl: true } }, false)).not.toBeNull();
    expect(browserReservedChord({ kind: 'key', key: 'F12' })?.use).toMatch(/devtools/);
    expect(browserReservedChord({ kind: 'key', key: 'F11' }, false)?.use).toMatch(/full screen/);
    expect(browserReservedChord({ kind: 'key', key: 'F4', mods: { alt: true } }, false)?.use).toMatch(/close/);
    expect(browserReservedChord({ kind: 'key', key: 'Escape', mods: { ctrl: true, shift: true } }, false)?.use).toMatch(/Task Manager/);
    expect(browserReservedChord({ kind: 'key', key: 'Delete', mods: { ctrl: true, shift: true } }, false)?.use).toMatch(/browsing data/);
    expect(browserReservedChord({ kind: 'key', key: 'Backspace', mods: { mod: true, shift: true } }, true)?.use).toMatch(/browsing data/);
    expect(browserReservedChord({ kind: 'key', key: 'F4' }, false)).toBeNull();
  });
});
