import { icon } from '../icons.gen';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

/** A mind map's topics, heaviest first, and a note to float beside them. */
export const MIND_MAP_STENCILS: readonly DiagramStencil[] = [
  {
    id: 'central-topic', label: 'Central topic', outline: 'ellipse', size: { width: 220, height: 110 },
    rows: [{ kind: 'label', text: 'Central topic', style: { bold: true, fontSize: 16 } }], icon: icon('centralTopic'),
  },
  {
    id: 'main-topic', label: 'Main topic', outline: 'roundRect', size: { width: 140, height: 50 },
    rows: [{ kind: 'label', text: 'Main topic', style: { bold: true, fontSize: 13 } }], icon: icon('mainTopic'),
  },
  {
    id: 'subtopic', label: 'Subtopic', outline: 'stadium', size: { width: 130, height: 40 },
    rows: [{ kind: 'label', text: 'Subtopic' }], icon: icon('subtopic'),
  },
  {
    id: 'floating-note', label: 'Note', outline: 'note', size: { width: 130, height: 80 },
    rows: [{ kind: 'label', text: 'Note', style: { fontSize: 11 } }], icon: icon('floatingNote'),
  },
];

/** The mind map topics as a stencil group. */
export const MIND_MAP_GROUP: StencilGroup = { id: 'mindMap', label: 'Mind map', stencils: MIND_MAP_STENCILS };
