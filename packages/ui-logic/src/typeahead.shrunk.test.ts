import { describe, expect, it } from 'vitest';
import { typeaheadMatch } from './typeahead';

const shape = { label: (s: string) => s };

describe('typeaheadMatch, shrunk', () => {
  it('lands on a label spelled decomposed when its composed letter is typed', () => {
    expect(typeaheadMatch(['x', 'Ápex'.normalize('NFD')], null, 'á', shape)).toBe(1);
    expect(typeaheadMatch(['x', 'Ápex'.normalize('NFD')], null, 'a', shape)).toBeNull();
  });
});
