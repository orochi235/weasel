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
});
