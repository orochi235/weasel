/** A flow of `value` from one node to another, named by their labels. */
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

/** A sankey diagram: nodes in columns by depth, joined by ribbons as thick as their flow. */
export interface SankeyData {
  kind: 'sankey';
  title?: string;
  links: readonly SankeyLink[];
}
