import { describe, expect, it } from 'vitest';
import { dataRegionStyle } from '../dataStyles';
import { diagramThemeFrom, roleEdgeStyle, roleStyle, themeDocValue } from './resolve';
import { DIAGRAM_THEMES } from './themes';

const paper = DIAGRAM_THEMES.paper!;
const PROTO_KEYS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty'];

describe('theme lookups by a name from data', () => {
  it.each(PROTO_KEYS)('reads %s as no theme, falling back', (key) => {
    expect(diagramThemeFrom(key, paper)).toBe(paper);
  });

  it.each(PROTO_KEYS)('reads role %s as the default role', (key) => {
    expect(roleStyle(paper, key)).toBe(paper.roles[paper.defaultRole]);
  });

  it.each(PROTO_KEYS)('draws a connector in role %s with the theme connector', (key) => {
    expect(roleEdgeStyle(paper, key)).toEqual(roleEdgeStyle(paper));
  });

  it.each(PROTO_KEYS)('draws a container in role %s with the theme container', (key) => {
    expect(dataRegionStyle({ role: 'container', style: key }, paper)).toEqual(paper.container);
  });

  it('writes a custom theme with a prototype-key id whole', () => {
    const custom = { ...paper, id: 'constructor' };
    expect(themeDocValue(custom)).toBe(custom);
    expect(themeDocValue(paper)).toBe('paper');
  });
});
