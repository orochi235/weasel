export const LEVELS: readonly ['patch', 'minor', 'major'];
export function atLevel(text: string, level: string): string;
export function isChangesetFile(name: string): boolean;
