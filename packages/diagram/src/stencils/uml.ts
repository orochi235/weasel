import { icon } from '../icons.gen';
import type { Row } from '../body';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

/** An attribute or an operation: left-aligned, as `name: type`. */
const member = (label: string, value: string): Row => ({ kind: 'field', label, value });
const DIVIDER: Row = { kind: 'divider' };

/** A class's compartments, top-aligned so a taller box grows its last one. An empty list leaves its
 *  compartment out. */
const compartments = (name: readonly Row[], attributes: readonly Row[], operations: readonly Row[]): Pick<DiagramStencil, 'rows' | 'verticalAlign'> => ({
  rows: [name, attributes, operations].filter((c) => c.length > 0).flatMap((c, i) => (i === 0 ? c : [DIVIDER, ...c])),
  verticalAlign: 'top',
});

/** UML's class-diagram and use-case symbols. */
export const UML_STENCILS: readonly DiagramStencil[] = [
  {
    id: 'uml-class', label: 'Class', outline: 'rect', size: { width: 160, height: 124 }, icon: icon('umlClass'),
    ...compartments(
      [{ kind: 'label', text: 'Class', style: { bold: true } }],
      [member('+ id', 'int'), member('+ name', 'String')],
      [member('+ getId()', 'int'), member('+ setName(n)', 'void')],
    ),
  },
  {
    id: 'uml-interface', label: 'Interface', outline: 'rect', size: { width: 160, height: 96 }, icon: icon('umlInterface'),
    ...compartments(
      [{ kind: 'label', text: '«interface»' }, { kind: 'label', text: 'Interface', style: { bold: true } }],
      [],
      [member('+ run()', 'void'), member('+ stop()', 'void')],
    ),
  },
  {
    id: 'uml-abstract', label: 'Abstract class', outline: 'rect', size: { width: 160, height: 108 }, icon: icon('umlAbstract'),
    ...compartments(
      [{ kind: 'label', text: 'AbstractClass', style: { bold: true, italic: true } }],
      [member('# id', 'int')],
      [{ kind: 'field', label: '+ draw()', value: 'void', style: { italic: true } }, member('+ getId()', 'int')],
    ),
  },
  { id: 'uml-package', label: 'Package', outline: 'folder', size: { width: 120, height: 80 }, icon: icon('umlPackage') },
  { id: 'uml-note', label: 'Note', outline: 'note', size: { width: 120, height: 70 }, icon: icon('umlNote') },
  { id: 'uml-actor', label: 'Actor', outline: 'actor', size: { width: 60, height: 90 }, padding: 2, icon: icon('umlActor') },
  { id: 'uml-use-case', label: 'Use case', outline: 'ellipse', size: { width: 140, height: 70 }, icon: icon('shape:ellipse') },
  { id: 'uml-component', label: 'Component', outline: 'component', size: { width: 150, height: 70 }, icon: icon('umlComponent') },
];

/** The UML symbols as a stencil group. */
export const UML_GROUP: StencilGroup = { id: 'uml', label: 'UML', stencils: UML_STENCILS };
