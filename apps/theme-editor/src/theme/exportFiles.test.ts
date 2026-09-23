import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSelections, loadDTCG, resolveTheme, themeAxes } from '@weasel-js/theme';
import { exportFile } from './exportFiles';
import { lookupOf, weasel } from './fixtures';
import { runtimeTheme } from './model';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const lookup = lookupOf();

describe('exportFile', () => {
  it("emits weasel's CSS exactly as the build does", () => {
    const file = exportFile('css', weasel, lookup);
    expect(file.filename).toBe('weasel.tokens.css');
    expect(file.text).toBe(readFileSync(resolve(repo, 'packages/theme/src/generated/tokens.css'), 'utf8'));
  });

  it('writes the definition byte for byte as the store saves it', () => {
    expect(exportFile('definition', weasel, lookup).text).toBe(readFileSync(resolve(repo, 'packages/theme/themes/weasel.json'), 'utf8'));
  });

  it('writes DTCG that names the theme', () => {
    const file = exportFile('dtcg', weasel, lookup);
    expect(file.filename).toBe('weasel.tokens.json');
    expect(JSON.parse(file.text).name).toBe('weasel');
  });

  it('writes DTCG that loads back with every density, not just the default', () => {
    const back = loadDTCG({ ...JSON.parse(exportFile('dtcg', weasel, lookup).text), extends: null });
    const theme = runtimeTheme(weasel, lookup);
    for (const sel of enumerateSelections(themeAxes(theme))) expect(resolveTheme(back, sel)).toEqual(resolveTheme(theme, sel));
  });
});
