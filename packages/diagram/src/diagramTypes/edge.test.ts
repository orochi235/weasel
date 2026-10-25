import { describe, expect, it } from 'vitest';
import { themeEdgeStroke } from '../theme/resolve';
import { DIAGRAM_THEMES } from '../theme/themes';
import { FLOWCHART_TYPE } from './catalog';
import { diagramTypeEdgeStroke } from './edge';

const paper = DIAGRAM_THEMES.paper!;

describe('diagramTypeEdgeStroke', () => {
  it("is the theme's connector stroke for a type that sets no markers", () => {
    expect(diagramTypeEdgeStroke(paper, FLOWCHART_TYPE)).toEqual(themeEdgeStroke(paper));
  });

  it("puts the type's markers over the theme's, and drops one the type sets to null", () => {
    const stroke = diagramTypeEdgeStroke(paper, { ...FLOWCHART_TYPE, edge: { markerStart: 'diamond', markerEnd: null } });
    expect(stroke.markerStart).toBe('diamond');
    expect('markerEnd' in stroke).toBe(false);
    expect(stroke.paint).toEqual(themeEdgeStroke(paper).paint);
  });
});
