import { describe, expect, it } from 'vitest';
import { DIAGRAM_JSON } from './jsonFormat';

describe('Diagram JSON, shrunk counterexamples', () => {
  it('refuses a page that is not an object, or of a kind it does not know, rather than failing on it', () => {
    expect(() => DIAGRAM_JSON.read!('{"format":"weasel-diagram","version":0,"pages":[null]}'))
      .toThrow('A weasel diagram document with a page that is not an object');
    expect(() => DIAGRAM_JSON.read!('{"format":"weasel-diagram","version":1,"pages":[{"id":"p","kind":"x"}]}'))
      .toThrow('A weasel diagram document with a page of kind "x", which this reader does not know');
  });
});
