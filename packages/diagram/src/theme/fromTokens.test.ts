import { describe, expect, it } from 'vitest';
import { diagramThemeFromTokens } from './fromTokens';
import { DIAGRAM_THEMES } from './themes';

const TOKENS: Record<string, string> = {
  '--wzl-surface': '#101010',
  '--wzl-surface-raised': ' #202020 ',
  '--wzl-surface-sunken': '#080808',
  '--wzl-fg': '#eeeeee',
  '--wzl-fg-muted': '#999999',
  '--wzl-border-strong': '#555555',
  '--wzl-accent': '#3388ff',
  '--wzl-danger': '#ff3333',
  '--wzl-font-ui': 'Inter, sans-serif',
  '--wzl-font-size': '13px',
};
const read = (token: string) => TOKENS[token] ?? '';

describe('diagramThemeFromTokens', () => {
  it("builds the page, shapes, and face from the host's resolved tokens", () => {
    const theme = diagramThemeFromTokens(read);
    expect(theme.page).toBe('#101010');
    expect(theme.roles.default).toEqual({ fill: '#202020', stroke: '#555555', text: '#eeeeee' });
    expect(theme.roles.accent!.stroke).toBe('#3388ff');
    expect(theme.roles.negative!.stroke).toBe('#ff3333');
    expect(theme.roles.muted!.text).toBe('#999999');
    expect(theme.edge.stroke).toBe('#999999');
    expect(theme.font).toEqual({ family: 'Inter, sans-serif', size: 13 });
  });

  it("takes paper's color for a token that reads empty", () => {
    const theme = diagramThemeFromTokens(read);
    expect(theme.roles.positive!.stroke).toBe(DIAGRAM_THEMES.paper!.roles.positive!.stroke);
    expect(diagramThemeFromTokens(() => '').font).toEqual(DIAGRAM_THEMES.paper!.font);
  });

  it('names every shared role', () => {
    expect(Object.keys(diagramThemeFromTokens(read).roles).sort())
      .toEqual(['accent', 'default', 'muted', 'negative', 'positive', 'warning']);
  });
});
