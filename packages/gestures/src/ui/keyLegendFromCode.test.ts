import { describe, expect, it } from 'vitest';
import { keyLegendFromCode } from './keyLegendFromCode';

describe('keyLegendFromCode', () => {
  it('prints letters and digits as their characters', () => {
    expect(keyLegendFromCode('KeyQ', { platform: 'macos' })).toEqual({ label: 'Q' });
    expect(keyLegendFromCode('Digit7', { platform: 'windows' })).toEqual({ label: '7' });
  });

  it('prints either side of a modifier as that modifier, per platform', () => {
    expect(keyLegendFromCode('MetaLeft', { platform: 'macos' })).toEqual({ label: '⌘' });
    expect(keyLegendFromCode('MetaRight', { platform: 'windows' })).toEqual({ label: '⊞' });
    expect(keyLegendFromCode('AltRight', { platform: 'linux', legend: 'text' })).toEqual({ label: 'Alt' });
  });

  it('prints named keys as keyLegendFromKey does', () => {
    expect(keyLegendFromCode('Escape', { platform: 'macos' })).toEqual({ label: '⎋' });
    expect(keyLegendFromCode('Escape', { platform: 'windows' })).toEqual({ label: 'Esc' });
    expect(keyLegendFromCode('NumpadEnter', { platform: 'windows' })).toEqual({ label: 'Enter' });
    expect(keyLegendFromCode('F11', { platform: 'linux' })).toEqual({ label: 'F11' });
  });

  it('prints punctuation as a US keyboard does', () => {
    expect(keyLegendFromCode('BracketLeft')).toEqual({ label: '[' });
    expect(keyLegendFromCode('Backquote')).toEqual({ label: '`' });
  });

  it('takes a label by code before the tables', () => {
    expect(keyLegendFromCode('KeyZ', { labels: { KeyZ: 'Y' } })).toEqual({ label: 'Y' });
    expect(keyLegendFromCode('ShiftLeft', { platform: 'macos', labels: { shift: 'Umschalt' } })).toEqual({ label: 'Umschalt' });
    expect(keyLegendFromCode('constructor', { platform: 'macos', labels: {} })).toEqual({ label: 'constructor' });
  });
});
