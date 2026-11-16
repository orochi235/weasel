import type ts from 'typescript';
export interface Site { line: number; access: 'read' | 'write'; text: string }
export function inScope(rel: string): boolean;
export function sitesIn(checker: ts.TypeChecker, sourceFile: ts.SourceFile): Site[];
export function classify(
  pending: readonly string[], exists: (rel: string) => boolean, siteCount: (rel: string) => number,
): { keep: string[]; clean: string[]; gone: string[] };
export function scan(root: string, rels: readonly string[]): Map<string, Site[] | null>;
