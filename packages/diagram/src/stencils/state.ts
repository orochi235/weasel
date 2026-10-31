import { icon } from '../icons.gen';
import type { ContainerStencil } from '../containers/containerStencils';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

/** A pseudostate has no text: a start, an end, a choice, or a fork or join. */
const pseudo = { rows: [], padding: 0 } as const;

/** A state machine's states and pseudostates, notes, and composite states. */
export const STATE_STENCILS: readonly (DiagramStencil | ContainerStencil)[] = [
  { id: 'state', label: 'State', outline: 'roundRect', size: { width: 120, height: 50 }, rows: [{ kind: 'label', text: 'State' }], icon: icon('task') },
  { id: 'state-start', label: 'Start', outline: 'start', size: { width: 20, height: 20 }, ...pseudo, icon: icon('stateStart') },
  { id: 'state-end', label: 'End', outline: 'end', size: { width: 20, height: 20 }, ...pseudo, icon: icon('stateEnd') },
  { id: 'state-choice', label: 'Choice', outline: 'diamond', size: { width: 28, height: 28 }, ...pseudo, icon: icon('shape:diamond') },
  { id: 'state-fork', label: 'Fork or join', outline: 'bar', size: { width: 80, height: 10 }, ...pseudo, icon: icon('stateFork') },
  { id: 'state-note', label: 'Note', outline: 'note', size: { width: 140, height: 60 }, rows: [{ kind: 'label', text: 'Note' }], icon: icon('umlNote') },
  { id: 'state-composite', label: 'Composite state', title: 'Composite', role: 'container', size: { width: 280, height: 180 }, icon: icon('container') },
  {
    id: 'state-concurrent', label: 'Concurrent state', title: 'Concurrent', role: 'pool', axis: 'y', lanes: ['Region 1', 'Region 2'],
    size: { width: 360, height: 240 }, icon: icon('poolRows'),
  },
];

/** The state machine symbols as a stencil group. */
export const STATE_GROUP: StencilGroup = { id: 'state', label: 'State', stencils: STATE_STENCILS };
