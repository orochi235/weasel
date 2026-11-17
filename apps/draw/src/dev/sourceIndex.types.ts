/** Where an export is declared: its file (repo-relative, with a leading
 *  slash), its line, and its JSDoc. */
export interface SourceMatch {
  path: string;
  /** 1-based line number of the export statement. */
  line: number;
  jsdoc: string | null;
}

export type SourceIndex = Record<string, SourceMatch>;
