import { KIT_SHAPE_KINDS } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { ANNOTATION_TOOLS, annotationToolInfo } from './toolMap';
import type { AnnotationKind } from './types';

const KINDS: AnnotationKind[] = ['stroke', 'line', 'arrow', 'rect', 'ellipse', 'text'];

describe('the annotation tool table', () => {
  it('offers one tool per mark kind, plus select', () => {
    expect(ANNOTATION_TOOLS.map((t) => t.id)).toEqual(['select', ...KINDS]);
  });

  it('only names weasel tools SceneCanvas will mount', () => {
    // Against the kit's own list, not a retyped copy: a tool id that stops
    // being built in should fail here rather than in a silent no-op palette.
    const mountable = new Set<string>([...KIT_SHAPE_KINDS, 'select']);
    for (const t of ANNOTATION_TOOLS) {
      expect(mountable, `${t.id} maps to a tool the kit does not mount`).toContain(
        annotationToolInfo(t.id)?.weaselTool,
      );
    }
  });

  it('gives select no kind, because it makes no mark', () => {
    expect(annotationToolInfo('select')).toEqual({ weaselTool: 'select' });
  });

  it('rides line and pencil for the two kinds with no tool of their own', () => {
    expect(annotationToolInfo('arrow')).toEqual({ weaselTool: 'line', kind: 'arrow' });
    expect(annotationToolInfo('stroke')).toEqual({ weaselTool: 'pencil', kind: 'stroke' });
  });

  it('answers undefined for a tool id that is not one of ours', () => {
    expect(annotationToolInfo('hand')).toBeUndefined();
  });
});
