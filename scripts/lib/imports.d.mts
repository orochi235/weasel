export const SOURCE: RegExp;
export function importSpecifiers(source: string): string[];
export function namedSpecifiers(source: string): string[];
export function packageOf(specifier: string): string;
export function isBare(specifier: string): boolean;
export function globImports(source: string): { patterns: string[]; modules: boolean }[];
export function unreadableImports(source: string): string[];
