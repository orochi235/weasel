import { describe, expect, it } from 'vitest';
import { chordKey, codeLetter } from './keyLetter';

describe('chordKey', () => {
  it('reads a chord that typed no Latin character by the letter or digit its key bears', () => {
    expect(chordKey({ key: 'я', code: 'KeyZ', ctrlKey: true })).toBe('Z');
    expect(chordKey({ key: 'Ω', code: 'KeyZ', altKey: true })).toBe('Z');
    expect(chordKey({ key: 'Dead', code: 'KeyE', altKey: true })).toBe('E');
    expect(chordKey({ key: '\u{10428}', code: 'KeyZ', ctrlKey: true })).toBe('Z');
  });

  it('reads an unshifted chord on a digit-row key that typed punctuation as its digit, as on AZERTY', () => {
    expect(chordKey({ key: '&', code: 'Digit1', ctrlKey: true })).toBe('1');
    expect(chordKey({ key: '(', code: 'Digit5', metaKey: true })).toBe('5');
    expect(chordKey({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true })).toBe('!');
    expect(chordKey({ key: "'", code: 'KeyQ', ctrlKey: true })).toBe("'");
    expect(chordKey({ key: '&', code: 'Digit1' })).toBe('&');
  });

  it('reads a key alone, a Latin character, or a key bearing no letter as what it typed', () => {
    expect(chordKey({ key: 'я', code: 'KeyZ' })).toBe('я');
    expect(chordKey({ key: 'a', code: 'KeyQ', ctrlKey: true })).toBe('a');
    expect(chordKey({ key: 'ж', code: 'Semicolon', ctrlKey: true })).toBe('ж');
    expect(chordKey({ key: 'Enter', code: 'Enter', ctrlKey: true })).toBe('Enter');
  });
});

describe('codeLetter', () => {
  it('names the letter or digit a physical key bears, and nothing for another key', () => {
    expect(codeLetter('KeyA')).toBe('A');
    expect(codeLetter('Digit7')).toBe('7');
    expect(codeLetter('Numpad7')).toBeUndefined();
    expect(codeLetter('')).toBeUndefined();
  });
});
