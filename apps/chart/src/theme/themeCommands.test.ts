import { describe, expect, it } from 'vitest';
import { DIAGRAM_THEMES, forkTheme, isShippedTheme, parseDiagramTheme, themeToJson, type DiagramTheme } from '@weasel-js/diagram';
import { importedTheme, themeFileName } from './themeCommands';

describe('themeFileName', () => {
  it('names an exported theme after it, with the theme file extension', () => {
    expect(themeFileName(DIAGRAM_THEMES.night!)).toBe('night.weasel-theme.json');
    expect(themeFileName(forkTheme(DIAGRAM_THEMES.paper!))).toBe('paper-edited.weasel-theme.json');
  });
});

describe('importedTheme', () => {
  const read = (theme: DiagramTheme) => (parseDiagramTheme(themeToJson(theme)) as { theme: DiagramTheme }).theme;

  it('takes an exported shipped theme back in as that shipped theme', () => {
    expect(importedTheme(read(DIAGRAM_THEMES.paper!))).toBe(DIAGRAM_THEMES.paper);
  });

  it("copies a theme that claims a shipped theme's id but differs from it under an id of its own", () => {
    const changed = { ...read(DIAGRAM_THEMES.paper!), page: '#123456' };
    const theme = importedTheme(changed);
    expect(theme.id).not.toBe('paper');
    expect(theme.page).toBe('#123456');
    expect(isShippedTheme(theme)).toBe(false);
  });

  it('keeps a custom theme as it is', () => {
    const fork = read(forkTheme(DIAGRAM_THEMES.paper!));
    expect(importedTheme(fork)).toBe(fork);
  });
});
