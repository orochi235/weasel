import { describe, expect, it } from 'vitest';
import { DIAGRAM_THEMES, forkTheme } from '@weasel-js/diagram';
import { themeFileName } from './themeCommands';

describe('themeFileName', () => {
  it('names an exported theme after it, with the theme file extension', () => {
    expect(themeFileName(DIAGRAM_THEMES.night!)).toBe('night.weasel-theme.json');
    expect(themeFileName(forkTheme(DIAGRAM_THEMES.paper!))).toBe('paper-edited.weasel-theme.json');
  });
});
