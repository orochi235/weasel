/** Templates: a new page of every kind a document holds, from an empty graph of each diagram type to a small chart. */
import { DIAGRAM_TYPES, FLOWCHART_NOTATION, type DiagramType } from '@weasel-js/diagram';
import type { PlotKind } from '@weasel-js/plot';
import type { DiagramDocument, DocumentPage, GraphPage } from '../document';
import { DIAGRAM_MERMAID } from '../mermaid/format';
import { PLOT_STARTERS, SEQUENCE_STARTER } from './starters';

/** Where a menu lists a template: with the diagrams, as a sequence diagram, or with the charts. */
export type PageTemplateGroup = 'diagram' | 'sequence' | 'chart';

/** A new page of one kind. */
export interface PageTemplate {
  id: string;
  label: string;
  icon?: DiagramType['icon'];
  group: PageTemplateGroup;
  /** The diagram type a document made from it takes: the one a graph template draws. */
  diagramType?: string;
  /** The page, under `id`. `size` is a graph page's; a sequence or a chart takes the size its content needs. */
  page(id: string, size?: { width: number; height: number }): DocumentPage;
}

/** A graph page's size when none is asked for: letter, landscape, at 96 per inch. */
export const TEMPLATE_PAGE_SIZE = { width: 1056, height: 816 } as const;

/** The page `source` reads into, under `id`. */
function readPage(source: string, id: string): DocumentPage {
  const { document } = DIAGRAM_MERMAID.read!(source) as { document: DiagramDocument };
  return { ...document.pages[0]!, id };
}

function graphTemplate(type: DiagramType): PageTemplate {
  return {
    id: type.id, label: type.label, group: 'diagram', diagramType: type.id, ...(type.icon !== undefined ? { icon: type.icon } : {}),
    page: (id, size = TEMPLATE_PAGE_SIZE): GraphPage => ({
      kind: 'graph', id, width: size.width, height: size.height, data: { nodes: [], edges: [] },
      notation: type.notations?.[0] ?? FLOWCHART_NOTATION,
    }),
  };
}

const SEQUENCE_TEMPLATE: PageTemplate = {
  id: 'sequence', label: 'Sequence', group: 'sequence', page: (id) => readPage(SEQUENCE_STARTER, id),
};

const plotTemplate = (kind: PlotKind): PageTemplate => ({
  id: `plot:${kind}`, label: PLOT_STARTERS[kind].label, group: 'chart', page: (id) => readPage(PLOT_STARTERS[kind].source, id),
});

/** Every template, by id, in menu order: each diagram type's, the sequence diagram's, then each chart kind's. */
export const PAGE_TEMPLATES: Readonly<Record<string, PageTemplate>> = Object.freeze(Object.fromEntries([
  ...Object.values(DIAGRAM_TYPES).map(graphTemplate),
  SEQUENCE_TEMPLATE,
  ...(Object.keys(PLOT_STARTERS) as PlotKind[]).map(plotTemplate),
].map((t) => [t.id, t])));
