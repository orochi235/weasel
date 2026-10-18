export const SOURCE: RegExp;
/** `file` names the grammar (`.ts`, `.tsx`, `.js`…) and the file in a parse error. */
export function importSpecifiers(source: string, file: string): string[];
export function namedSpecifiers(source: string, file: string): string[];
export function packageOf(specifier: string): string;
export function isBare(specifier: string): boolean;
export function scanImports(
  source: string,
  file: string,
): { specifiers: string[]; globs: { patterns: string[]; modules: boolean }[]; unreadable: string[] };
