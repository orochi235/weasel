import { icon } from '../icons.gen';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

/** An entity-relationship diagram's symbols: a crow's-foot entity table beside Chen's shapes. */
export const ERD_STENCILS: readonly DiagramStencil[] = [
  {
    id: 'erd-entity', label: 'Entity', outline: 'rect', size: { width: 140, height: 100 }, verticalAlign: 'top', icon: icon('erdEntity'),
    rows: [
      { kind: 'label', text: 'Entity', style: { bold: true } },
      { kind: 'divider' },
      { kind: 'field', label: 'id', value: 'PK' },
      { kind: 'field', label: 'name', value: 'text' },
      { kind: 'field', label: 'owner_id', value: 'FK' },
    ],
  },
  { id: 'erd-weak-entity', label: 'Weak entity', outline: 'doubleRect', size: { width: 130, height: 60 }, icon: icon('erdWeakEntity') },
  { id: 'erd-relationship', label: 'Relationship', outline: 'diamond', size: { width: 130, height: 80 }, icon: icon('shape:diamond') },
  { id: 'erd-attribute', label: 'Attribute', outline: 'ellipse', size: { width: 110, height: 50 }, icon: icon('shape:ellipse') },
];

/** The ERD symbols as a stencil group. */
export const ERD_GROUP: StencilGroup = { id: 'erd', label: 'ERD', stencils: ERD_STENCILS };
