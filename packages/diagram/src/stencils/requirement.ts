import { icon } from '../icons.gen';
import type { Row } from '../body';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

const SMALL = { fontSize: 10 } as const;

/** A block: its `<<kind>>`, its name in bold, a divider, and a `field` row per field, top-aligned. */
function block(id: string, label: string, kind: string, name: string, fields: readonly [string, string][]): DiagramStencil {
  const rows: Row[] = [
    { kind: 'label', text: `<<${kind}>>`, style: SMALL },
    { kind: 'label', text: name, style: { bold: true } },
    { kind: 'divider' },
    ...fields.map(([l, value]): Row => ({ kind: 'field', label: l, value })),
  ];
  const icons = kind === 'element' ? icon('umlComponent') : icon('requirement');
  return { id, label, outline: 'rect', size: { width: 220, height: 60 + 18 * fields.length }, verticalAlign: 'top', rows, icon: icons };
}

/** What a requirement says of itself: its id, its text, its risk, and how it is verified. */
const REQUIREMENT_FIELDS: readonly [string, string][] = [['id', '1'], ['text', 'The system shall…'], ['risk', 'Medium'], ['verifymethod', 'Test']];

/** A requirement diagram's requirements and the elements that satisfy them. */
export const REQUIREMENT_STENCILS: readonly DiagramStencil[] = [
  block('requirement', 'Requirement', 'requirement', 'Requirement', REQUIREMENT_FIELDS),
  block('functional-requirement', 'Functional requirement', 'functionalRequirement', 'Functional', REQUIREMENT_FIELDS),
  block('design-constraint', 'Design constraint', 'designConstraint', 'Constraint', REQUIREMENT_FIELDS),
  block('requirement-element', 'Element', 'element', 'Element', [['type', 'module'], ['docref', 'docs/']]),
];

/** The requirement diagram symbols as a stencil group. */
export const REQUIREMENT_GROUP: StencilGroup = { id: 'requirement', label: 'Requirement', stencils: REQUIREMENT_STENCILS };
