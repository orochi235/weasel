import { derive, toLch } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { lookupOf } from './fixtures';
import { countTokens } from './model';
import { starterDefinition, themeNameProblem } from './starter';

describe('starterDefinition', () => {
  const harbor = starterDefinition('harbor');
  const result = derive(harbor, { mode: 'dark' }, lookupOf(harbor));

  it("extends weasel and generates its own ramps over weasel's pins", () => {
    expect(harbor.extends).toBe('weasel');
    expect(result.issues).toEqual([]);
    expect(result.provenance['gray-800']).toMatchObject({ layer: 'ramps', pinned: false });
    expect(countTokens(harbor, result).overridden).toBe(0);
  });

  it('keeps chroma at both ends of its accent', () => {
    for (const step of ['soft', 'strong']) expect(toLch(String(result.tokens[`accent-${step}`].value)).C).toBeGreaterThan(0.02);
  });
});

describe('themeNameProblem', () => {
  it('accepts a new lowercase name and says what is wrong with anything else', () => {
    expect(themeNameProblem('harbor', ['weasel'])).toBeNull();
    expect(themeNameProblem('weasel', ['weasel'])).toBe('weasel already exists.');
    expect(themeNameProblem('Harbor', ['weasel'])).toMatch(/lowercase/);
  });
});
