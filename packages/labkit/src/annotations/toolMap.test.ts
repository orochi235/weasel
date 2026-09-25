import { KIT_SHAPE_KINDS } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import type { InstrumentList } from '../instrument/types';
import { resolveLabTool } from '../tools/labTool';
import { ANNOTATION_TOOLS, annotationToolInfo, labAnnotationTools } from './toolMap';
import type { AnnotationKind, AnnotationToolId } from './types';

const KINDS: AnnotationKind[] = ['stroke', 'line', 'arrow', 'rect', 'ellipse', 'text'];

describe('the annotation tool table', () => {
  it('offers one tool per mark kind, plus pointer and select', () => {
    expect(ANNOTATION_TOOLS.map((t) => t.id)).toEqual(['pointer', 'select', ...KINDS]);
  });

  it('gives pointer no entry at all, which is what leaves the overlay idle', () => {
    expect(annotationToolInfo('pointer')).toBeUndefined();
  });

  it('only names weasel tools SceneCanvas will mount', () => {
    // Against the kit's own list, not a retyped copy: a tool id that stops
    // being built in should fail here rather than in a silent no-op palette.
    const mountable = new Set<string>([...KIT_SHAPE_KINDS, 'select']);
    for (const t of ANNOTATION_TOOLS) {
      const info = annotationToolInfo(t.id);
      if (!info) continue;
      expect(mountable, `${t.id} maps to a tool the kit does not mount`).toContain(info.weaselTool);
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

describe('the tools a lab rail carries', () => {
  const ids = (instruments: InstrumentList) => labAnnotationTools(instruments).map((t) => t.id);
  const inst = (annotations?: { tools?: AnnotationToolId[] }) =>
    ({
      annotations: annotations && { targets: () => [], ...annotations },
    }) as unknown as InstrumentList[number];

  it('carries none when no instrument annotates', () => {
    expect(ids([inst()])).toEqual([]);
  });

  it('carries every tool for an instrument that names none', () => {
    expect(ids([inst({})])).toEqual(ANNOTATION_TOOLS.map((t) => t.id));
  });

  it('carries only the named tools, in the kit order', () => {
    expect(ids([inst({ tools: ['select', 'pointer'] })])).toEqual(['pointer', 'select']);
  });

  it('carries the union across annotating instruments', () => {
    expect(ids([inst({ tools: ['pointer'] }), inst({ tools: ['rect'] }), inst()])).toEqual([
      'pointer',
      'rect',
    ]);
  });

  it('starts the lab in pointer when the rail has it, else in its first tool', () => {
    expect(resolveLabTool(null, [inst({ tools: ['select', 'pointer'] })])).toBe('pointer');
    expect(resolveLabTool(null, [inst({ tools: ['text', 'select'] })])).toBe('select');
    expect(resolveLabTool(null, [inst()])).toBeNull();
  });
});
