import type ts from 'typescript';
export interface Site { line: number; access: 'read' | 'write'; text: string }
export function inScope(rel: string): boolean;
export function sitesIn(checker: ts.TypeChecker, sourceFile: ts.SourceFile): Site[];
export function verdict(
  pending: readonly string[], exists: (rel: string) => boolean, sitesOf: ReadonlyMap<string, readonly Site[]>,
): { unlisted: [string, Site[]][]; keep: string[]; clean: string[]; gone: string[] };
export function scan(root: string, filter?: string): Map<string, Site[]>;
