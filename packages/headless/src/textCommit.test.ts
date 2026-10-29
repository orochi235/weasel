import { editEnd, imeKey } from './textCommit';

describe('editEnd', () => {
  it('commits on Enter and blur and cancels on Escape', () => {
    expect(editEnd({ key: 'Enter' })).toBe('commit');
    expect(editEnd({ key: 'Enter', shift: true })).toBe('commit');
    expect(editEnd('blur')).toBe('commit');
    expect(editEnd({ key: 'Escape' })).toBe('cancel');
  });

  it('leaves every other key to the field', () => {
    for (const key of ['a', 'Backspace', 'ArrowLeft', 'Tab']) expect(editEnd({ key })).toBeNull();
  });

  it('commits on Escape when the shape says so', () => {
    expect(editEnd({ key: 'Escape' }, { escape: 'commit' })).toBe('commit');
  });

  it('leaves Shift+Enter to a multiline field', () => {
    expect(editEnd({ key: 'Enter', shift: true }, { multiline: true })).toBeNull();
    expect(editEnd({ key: 'Enter' }, { multiline: true })).toBe('commit');
  });
});

describe('imeKey', () => {
  it('claims a key pressed mid-composition, Safari\'s closing Enter included', () => {
    expect(imeKey({ key: 'Enter', isComposing: true })).toBe(true);
    expect(imeKey({ key: 'Enter', keyCode: 229 })).toBe(true);
    expect(imeKey({ key: 'Process' })).toBe(true);
    expect(imeKey({ key: 'Dead' })).toBe(true);
  });

  it('leaves a plain key to the field', () => {
    expect(imeKey({ key: 'Enter', isComposing: false, keyCode: 13 })).toBe(false);
    expect(imeKey({ key: 'Escape' })).toBe(false);
  });
});
