import { icon } from '../icons.gen';
import type { Row } from '../body';
import type { ContainerStencil } from '../containers/containerStencils';
import type { StencilGroup } from '../diagramTypes/types';
import type { Outline } from '../outline';
import type { DiagramStencil } from '../stencil';
import type { IconRef } from '@weasel-js/icons';

const SMALL = { fontSize: 10 } as const;

interface Element {
  id: string;
  label: string;
  /** The `<<kind>>` a C4 writer reads the element's macro from: `external_system_db`. */
  kind: string;
  outline: Outline;
  icon: IconRef;
  /** Containers and components carry one; people and systems do not. */
  technology?: string;
  width?: number;
  height?: number;
}

/** An element: its `<<kind>>`, its name in bold, its `[technology]`, and its description, in the theme's accent
 *  role, or its muted one outside the system. */
function element(e: Element): DiagramStencil {
  const name = e.label.replace(/ \(external\)$/, '');
  const rows: Row[] = [
    { kind: 'label', text: `<<${e.kind}>>`, style: SMALL },
    { kind: 'label', text: name, style: { bold: true } },
    ...(e.technology !== undefined ? [{ kind: 'label' as const, text: `[${e.technology}]`, style: SMALL }] : []),
    { kind: 'label', text: 'What it does' },
  ];
  return {
    id: e.id, label: e.label, outline: e.outline, size: { width: e.width ?? 200, height: e.height ?? 110 }, rows, icon: e.icon,
    themeRole: e.kind.startsWith('external_') ? 'muted' : 'accent',
  };
}

const boundary = (id: string, label: string, title: string): ContainerStencil =>
  ({ id, label, title, role: 'container', size: { width: 320, height: 220 }, icon: icon('container') });

/** C4's people, systems, containers, and components, each a store or a queue where C4 has one, and the
 *  boundaries around them. */
export const C4_STENCILS: readonly (DiagramStencil | ContainerStencil)[] = [
  element({ id: 'c4-person', label: 'Person', kind: 'person', outline: 'person', icon: icon('person'), height: 170 }),
  element({ id: 'c4-person-ext', label: 'Person (external)', kind: 'external_person', outline: 'person', icon: icon('user'), height: 170 }),
  element({ id: 'c4-system', label: 'System', kind: 'system', outline: 'roundRect', icon: icon('task') }),
  element({ id: 'c4-system-ext', label: 'System (external)', kind: 'external_system', outline: 'roundRect', icon: icon('task') }),
  element({ id: 'c4-system-db', label: 'System database', kind: 'system_db', outline: 'cylinder', icon: icon('database'), height: 130 }),
  element({ id: 'c4-system-queue', label: 'System queue', kind: 'system_queue', outline: 'queue', icon: icon('queue') }),
  element({ id: 'c4-container', label: 'Container', kind: 'container', outline: 'roundRect', icon: icon('c4Container'), technology: 'Technology', height: 120 }),
  element({
    id: 'c4-container-db', label: 'Container database', kind: 'container_db', outline: 'cylinder', icon: icon('database'), technology: 'Technology', height: 150,
  }),
  element({ id: 'c4-container-queue', label: 'Container queue', kind: 'container_queue', outline: 'queue', icon: icon('queue'), technology: 'Technology', width: 240, height: 120 }),
  element({ id: 'c4-component', label: 'Component', kind: 'component', outline: 'roundRect', icon: icon('umlComponent'), technology: 'Technology', height: 120 }),
  boundary('c4-enterprise-boundary', 'Enterprise boundary', 'Enterprise [enterprise]'),
  boundary('c4-system-boundary', 'System boundary', 'System [system]'),
  boundary('c4-container-boundary', 'Container boundary', 'Container [container]'),
];

/** The C4 symbols as a stencil group. */
export const C4_GROUP: StencilGroup = { id: 'c4', label: 'C4', stencils: C4_STENCILS };
