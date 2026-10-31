import { icon } from '../icons.gen';
import type { ContainerStencil } from '../containers/containerStencils';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

/** A kanban board: a pool whose lanes are its columns, and cards to stack down them, each with a `field` row of
 *  metadata. */
export const KANBAN_STENCILS: readonly (DiagramStencil | ContainerStencil)[] = [
  {
    id: 'kanban-board', label: 'Board', title: 'Board', role: 'pool', axis: 'x', lanes: ['To do', 'In progress', 'Done'],
    size: { width: 660, height: 420 }, icon: icon('poolColumns'),
  },
  {
    id: 'kanban-card', label: 'Card', outline: 'rect', size: { width: 180, height: 60 }, verticalAlign: 'top',
    rows: [{ kind: 'label', text: 'Task' }, { kind: 'field', label: 'assigned', value: 'someone' }], icon: icon('kanbanCard'),
  },
];

/** The kanban symbols as a stencil group. */
export const KANBAN_GROUP: StencilGroup = { id: 'kanban', label: 'Kanban', stencils: KANBAN_STENCILS };
