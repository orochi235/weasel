import { icon } from '../icons.gen';
import type { Row, RowTextStyle } from '../body';
import type { StencilGroup } from '../diagramTypes/types';
import type { DiagramStencil } from '../stencil';

/** A card's two lines: the person's name over their title. Both are labels rather than a `field`,
 *  which would print as "Title: …" flush left under a centered name. */
const card = (name: RowTextStyle, title: RowTextStyle): readonly Row[] => [
  { kind: 'label', text: 'Name', style: name, id: 'name' },
  { kind: 'label', text: 'Title', style: title, id: 'title' },
];

/** People and the departments they sit in. */
export const ORG_STENCILS: readonly DiagramStencil[] = [
  {
    id: 'person', label: 'Person', outline: 'roundRect', size: { width: 160, height: 64 },
    rows: card({ bold: true }, { fontSize: 11 }), icon: icon('person'),
  },
  {
    id: 'executive', label: 'Executive', outline: 'roundRect', size: { width: 200, height: 84 },
    rows: card({ bold: true, fontSize: 15 }, { fontSize: 12 }), icon: icon('executive'),
  },
  {
    id: 'assistant', label: 'Assistant', outline: 'roundRect', size: { width: 140, height: 56 },
    rows: card({ bold: true, fontSize: 11 }, { fontSize: 10 }), icon: icon('assistant'),
  },
  {
    id: 'vacancy', label: 'Vacancy', outline: 'roundRect', size: { width: 160, height: 64 },
    rows: [{ kind: 'label', text: 'Vacant', style: { bold: true }, id: 'name' }, { kind: 'label', text: 'Title', style: { fontSize: 11 }, id: 'title' }],
    style: { dash: [6, 4] }, icon: icon('vacancy'),
  },
  {
    id: 'department', label: 'Department', outline: 'rect', size: { width: 200, height: 56 },
    rows: [{ kind: 'label', text: 'Department', style: { bold: true, fontSize: 13 } }], icon: icon('department'),
  },
];

/** The org chart cards as a stencil group. */
export const ORG_GROUP: StencilGroup = { id: 'org', label: 'Org chart', stencils: ORG_STENCILS };
