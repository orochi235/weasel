import type { ThemeDefinition } from '@weasel-js/theme';

const NAME = /^[a-z][a-z0-9-]*$/;

export function themeNameProblem(name: string, existing: readonly string[]): string | null {
  if (!NAME.test(name)) return 'Use lowercase letters, digits and hyphens, starting with a letter.';
  if (existing.includes(name)) return `${name} already exists.`;
  return null;
}

/** A new theme: three seeds, and a gray and an accent generated from them over weasel. */
export function starterDefinition(name: string): ThemeDefinition {
  return {
    name,
    extends: 'weasel',
    seeds: { brand: '#0b6e8a', neutralHue: 220, neutralChroma: 0.012 },
    ramps: {
      gray: {
        kind: 'lightness',
        steps: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
        lightness: [0.973, 0.163],
        curve: 0.41,
        hue: '{seeds.neutralHue}',
        chroma: { peak: '{seeds.neutralChroma}', darkBias: 0.84 },
      },
      accent: {
        kind: 'lightness',
        steps: ['soft', 'base', 'strong'],
        lightness: [0.252, 0.471],
        anchor: { base: '{seeds.brand}' },
        chroma: { peak: 0, lightBias: 1, darkBias: 1 },
      },
    },
  };
}
