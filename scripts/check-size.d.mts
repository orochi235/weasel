export interface Size { lines: number; longestFunction: number }
export interface Allowed { lines?: number; longestFunction?: number }
export function measure(source: string, fileName?: string): Size;
export function verdict(size: Size, allowed: Allowed | undefined, caps: { lines: number; fn: number }): 'ok' | 'over' | 'stale';
