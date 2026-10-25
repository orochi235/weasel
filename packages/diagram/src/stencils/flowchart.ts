import { icon } from '../icons.gen';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

/** The basic flowchart symbols. */
export const FLOWCHART_STENCILS: readonly DiagramStencil[] = [
  { id: 'process', label: 'Process', outline: 'rect', size: { width: 120, height: 60 }, icon: icon('shape:rectangle') },
  { id: 'decision', label: 'Decision', outline: 'diamond', size: { width: 120, height: 80 }, icon: icon('shape:diamond') },
  { id: 'terminal', label: 'Terminal', outline: 'stadium', size: { width: 120, height: 50 }, icon: icon('shape:stadium') },
  { id: 'data', label: 'Data', outline: 'parallelogram', size: { width: 130, height: 60 }, icon: icon('shape:parallelogram') },
  { id: 'manual', label: 'Manual', outline: 'trapezoid', size: { width: 130, height: 60 }, icon: icon('shape:trapezoidSide') },
  { id: 'preparation', label: 'Preparation', outline: 'hexagon', size: { width: 130, height: 60 }, icon: icon('shape:hexagonFlat') },
  { id: 'connector', label: 'Connector', outline: 'ellipse', size: { width: 50, height: 50 }, icon: icon('shape:circle') },
];

/** The flowchart symbols as a stencil group. */
export const FLOWCHART_GROUP: StencilGroup = { id: 'flowchart', label: 'Flowchart', stencils: FLOWCHART_STENCILS };
