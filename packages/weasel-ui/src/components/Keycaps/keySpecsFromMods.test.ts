import { describe, it, expect } from 'vitest';
import { keySpecsFromMods, keySpecFromKey, type Platform } from './keySpecsFromMods';

describe('keySpecsFromMods — platform mapping', () => {
  it('maps `mod` to ⌘ on macOS (symbol legend default)', () => {
    expect(keySpecsFromMods([{ name: 'mod' }], { platform: 'macos' }))
      .toEqual([{ label: '⌘' }]);
  });

  it('maps `mod` to Ctrl on Windows (text legend default)', () => {
    expect(keySpecsFromMods([{ name: 'mod' }], { platform: 'windows' }))
      .toEqual([{ label: 'Ctrl' }]);
  });

  it('maps `mod` to Ctrl on Linux', () => {
    expect(keySpecsFromMods([{ name: 'mod' }], { platform: 'linux' }))
      .toEqual([{ label: 'Ctrl' }]);
  });

  it('maps `meta` to ⌘ / ⊞ / ⊞ per OS', () => {
    expect(keySpecsFromMods([{ name: 'meta' }], { platform: 'macos' }))   .toEqual([{ label: '⌘' }]);
    expect(keySpecsFromMods([{ name: 'meta' }], { platform: 'windows' })) .toEqual([{ label: 'Win' }]);
    expect(keySpecsFromMods([{ name: 'meta' }], { platform: 'linux' }))   .toEqual([{ label: 'Super' }]);
  });

  it('maps `alt` to ⌥ on Mac, Alt elsewhere', () => {
    expect(keySpecsFromMods([{ name: 'alt' }], { platform: 'macos' }))   .toEqual([{ label: '⌥' }]);
    expect(keySpecsFromMods([{ name: 'alt' }], { platform: 'windows' })) .toEqual([{ label: 'Alt' }]);
    expect(keySpecsFromMods([{ name: 'alt' }], { platform: 'linux' }))   .toEqual([{ label: 'Alt' }]);
  });

  it('maps `ctrl` to ⌃ on Mac, Ctrl elsewhere', () => {
    expect(keySpecsFromMods([{ name: 'ctrl' }], { platform: 'macos' })).toEqual([{ label: '⌃' }]);
    expect(keySpecsFromMods([{ name: 'ctrl' }], { platform: 'windows' })).toEqual([{ label: 'Ctrl' }]);
  });

  it('maps `shift` to ⇧ on every platform (symbol mode is universal)', () => {
    for (const p of ['macos', 'windows', 'linux'] as const) {
      expect(keySpecsFromMods([{ name: 'shift' }], { platform: p, legend: 'symbol' }))
        .toEqual([{ label: '⇧' }]);
    }
  });
});

describe('keySpecsFromMods — legend override', () => {
  it('honors legend: "text" on macOS (Cmd / Option / Control / Shift)', () => {
    expect(keySpecsFromMods([{ name: 'mod' }, { name: 'alt' }, { name: 'ctrl' }, { name: 'shift' }], { platform: 'macos', legend: 'text' }))
      .toEqual([{ label: 'Cmd' }, { label: 'Option' }, { label: 'Control' }, { label: 'Shift' }]);
  });

  it('honors legend: "symbol" on Windows (Shift stays ⇧; mod/alt/ctrl remain text since they have no widely-recognized symbol)', () => {
    expect(keySpecsFromMods([{ name: 'mod' }, { name: 'shift' }, { name: 'meta' }], { platform: 'windows', legend: 'symbol' }))
      .toEqual([{ label: 'Ctrl' }, { label: '⇧' }, { label: '⊞' }]);
  });

  it('defaults to symbol on macOS, text on others (when legend is omitted)', () => {
    const macSpecs = keySpecsFromMods([{ name: 'mod' }], { platform: 'macos' });
    const winSpecs = keySpecsFromMods([{ name: 'mod' }], { platform: 'windows' });
    expect(macSpecs).toEqual([{ label: '⌘' }]);
    expect(winSpecs).toEqual([{ label: 'Ctrl' }]);
  });

  it('explicit legend: "auto" matches the default behavior', () => {
    for (const p of ['macos', 'windows', 'linux'] as const) {
      const auto = keySpecsFromMods([{ name: 'mod' }], { platform: p, legend: 'auto' });
      const def = keySpecsFromMods([{ name: 'mod' }], { platform: p });
      expect(auto).toEqual(def);
    }
  });
});

describe('keySpecsFromMods — optional flag', () => {
  it('forwards the `optional` flag onto the KeySpec', () => {
    const out = keySpecsFromMods([{ name: 'mod' }, { name: 'shift', optional: true }], { platform: 'macos' });
    expect(out).toEqual([{ label: '⌘' }, { label: '⇧', optional: true }]);
  });

  it('omits the `optional` field on required modifiers (clean KeySpec shape)', () => {
    const out = keySpecsFromMods([{ name: 'mod' }], { platform: 'macos' });
    expect(out[0]).not.toHaveProperty('optional');
  });
});

describe('keySpecsFromMods — order + length', () => {
  it('preserves input order', () => {
    const out = keySpecsFromMods(
      [{ name: 'shift' }, { name: 'mod' }, { name: 'alt' }],
      { platform: 'macos' },
    );
    expect(out.map((k) => k.label)).toEqual(['⇧', '⌘', '⌥']);
  });

  it('returns an empty array on empty input', () => {
    expect(keySpecsFromMods([], { platform: 'macos' })).toEqual([]);
  });
});

describe('keySpecsFromMods — platform detection (smoke)', () => {
  it('uses detected platform when no override is passed', () => {
    // We don't assert which platform is detected (vitest's jsdom UA could be
    // anything) — only that the call returns a non-empty result and the
    // label is one of the expected `mod` glyphs.
    const [{ label }] = keySpecsFromMods([{ name: 'mod' }]) as [{ label: string }];
    expect(['⌘', 'Ctrl']).toContain(label);
  });
});

// Type-level smoke: `Platform` should be the canonical union.
const _platforms: Platform[] = ['macos', 'windows', 'linux'];
void _platforms;

describe('keySpecFromKey — named keys', () => {
  it('renders Escape as ⎋ on macOS, Esc on Windows / Linux', () => {
    expect(keySpecFromKey('Escape', { platform: 'macos' })).toEqual({ label: '⎋' });
    expect(keySpecFromKey('Escape', { platform: 'windows' })).toEqual({ label: 'Esc' });
    expect(keySpecFromKey('Escape', { platform: 'linux' })).toEqual({ label: 'Esc' });
  });

  it('renders Enter as ↵ on macOS, Enter on Windows / Linux', () => {
    expect(keySpecFromKey('Enter', { platform: 'macos' })).toEqual({ label: '↵' });
    expect(keySpecFromKey('Enter', { platform: 'windows' })).toEqual({ label: 'Enter' });
  });

  it('renders Tab / Space / Backspace / Delete with the same convention', () => {
    expect(keySpecFromKey('Tab', { platform: 'macos' })).toEqual({ label: '⇥' });
    expect(keySpecFromKey('Tab', { platform: 'windows' })).toEqual({ label: 'Tab' });
    expect(keySpecFromKey('Backspace', { platform: 'macos' })).toEqual({ label: '⌫' });
    expect(keySpecFromKey('Backspace', { platform: 'windows' })).toEqual({ label: 'Backspace' });
    expect(keySpecFromKey(' ', { platform: 'macos' })).toEqual({ label: '␣' });
    expect(keySpecFromKey(' ', { platform: 'windows' })).toEqual({ label: 'Space' });
  });

  it('renders arrows as their Unicode glyphs on every platform', () => {
    expect(keySpecFromKey('ArrowUp', { platform: 'macos' })).toEqual({ label: '↑' });
    expect(keySpecFromKey('ArrowUp', { platform: 'windows' })).toEqual({ label: '↑' });
  });

  it('uppercases single-character keys (so `"a"` reads as `A`)', () => {
    expect(keySpecFromKey('a', { platform: 'macos' })).toEqual({ label: 'A' });
    expect(keySpecFromKey('k', { platform: 'windows' })).toEqual({ label: 'K' });
  });

  it('passes unknown multi-character keys through unchanged', () => {
    expect(keySpecFromKey('F1', { platform: 'macos' })).toEqual({ label: 'F1' });
    expect(keySpecFromKey('Insert', { platform: 'windows' })).toEqual({ label: 'Insert' });
  });

  it('forwards the optional flag', () => {
    expect(keySpecFromKey('Escape', { platform: 'macos', optional: true }))
      .toEqual({ label: '⎋', optional: true });
  });

  it('honors legend: "text" to force-text-mode on macOS', () => {
    expect(keySpecFromKey('Escape', { platform: 'macos', legend: 'text' })).toEqual({ label: 'Esc' });
    expect(keySpecFromKey('Enter', { platform: 'macos', legend: 'text' })).toEqual({ label: 'Return' });
  });

  it('explicit legend: "auto" matches default behavior on Escape', () => {
    expect(keySpecFromKey('Escape', { platform: 'macos', legend: 'auto' })).toEqual({ label: '⎋' });
    expect(keySpecFromKey('Escape', { platform: 'windows', legend: 'auto' })).toEqual({ label: 'Esc' });
  });
});
