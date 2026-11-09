/** Whether `key` is one code point: a typed character, astral ones included. */
export const oneCodePoint = (key: string): boolean =>
  key.length === 1 || (key.length === 2 && key.codePointAt(0)! > 0xffff);
