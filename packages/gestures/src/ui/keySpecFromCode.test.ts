import { describe, expect, it } from 'vitest';
import { keySpecFromCode } from './keySpecFromCode';

describe('keySpecFromCode', () => {
  it('prints letters and digits as their characters', () => {
    expect(keySpecFromCode('KeyQ', { platform: 'macos' })).toEqual({ label: 'Q' });
    expect(keySpecFromCode('Digit7', { platform: 'windows' })).toEqual({ label: '7' });
  });

  it('prints either side of a modifier as that modifier, per platform', () => {
    expect(keySpecFromCode('MetaLeft', { platform: 'macos' })).toEqual({ label: '⌘' });
    expect(keySpecFromCode('MetaRight', { platform: 'windows' })).toEqual({ label: '⊞' });
    expect(keySpecFromCode('AltRight', { platform: 'linux', legend: 'text' })).toEqual({ label: 'Alt' });
  });

  it('prints named keys as keySpecFromKey does', () => {
    expect(keySpecFromCode('Escape', { platform: 'macos' })).toEqual({ label: '⎋' });
    expect(keySpecFromCode('Escape', { platform: 'windows' })).toEqual({ label: 'Esc' });
    expect(keySpecFromCode('NumpadEnter', { platform: 'windows' })).toEqual({ label: 'Enter' });
    expect(keySpecFromCode('F11', { platform: 'linux' })).toEqual({ label: 'F11' });
  });

  it('prints punctuation as a US keyboard does', () => {
    expect(keySpecFromCode('BracketLeft')).toEqual({ label: '[' });
    expect(keySpecFromCode('Backquote')).toEqual({ label: '`' });
  });

  it('takes a label by code before the tables', () => {
    expect(keySpecFromCode('KeyZ', { labels: { KeyZ: 'Y' } })).toEqual({ label: 'Y' });
    expect(keySpecFromCode('ShiftLeft', { platform: 'macos', labels: { shift: 'Umschalt' } })).toEqual({ label: 'Umschalt' });
  });
});
