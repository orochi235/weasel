import { icon } from '../icons.gen';
import type { ContainerStencil } from '../containers/containerStencils';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

const SERVICE = { width: 100, height: 90 };
const named = (text: string) => ({ rows: [{ kind: 'label' as const, text }] });

/** An architecture diagram's services, by the icons Mermaid builds in, a junction to join edges at, and a group. */
export const ARCHITECTURE_STENCILS: readonly (DiagramStencil | ContainerStencil)[] = [
  { id: 'arch-service', label: 'Service', outline: 'roundRect', size: { width: 120, height: 50 }, ...named('Service'), icon: icon('task') },
  { id: 'arch-server', label: 'Server', outline: 'server', size: SERVICE, ...named('Server'), icon: icon('server') },
  { id: 'arch-database', label: 'Database', outline: 'cylinder', size: SERVICE, ...named('Database'), icon: icon('database') },
  { id: 'arch-disk', label: 'Disk', outline: 'disk', size: SERVICE, ...named('Disk'), icon: icon('database') },
  { id: 'arch-cloud', label: 'Cloud', outline: 'cloud', size: { width: 120, height: 80 }, ...named('Cloud'), icon: icon('cloud') },
  { id: 'arch-internet', label: 'Internet', outline: 'globe', size: SERVICE, ...named('Internet'), icon: icon('internet') },
  { id: 'arch-junction', label: 'Junction', outline: 'start', size: { width: 12, height: 12 }, rows: [], padding: 0, icon: icon('stateStart') },
  { id: 'arch-group', label: 'Group', role: 'container', size: { width: 300, height: 200 }, icon: icon('container') },
];

/** The architecture symbols as a stencil group. */
export const ARCHITECTURE_GROUP: StencilGroup = { id: 'architecture', label: 'Architecture', stencils: ARCHITECTURE_STENCILS };
