export const PALETTE_FILES: { readonly lego: string; readonly copic: string };
export interface LegoRow {
  name: string;
  hex: string;
}
export interface CopicRow {
  name: string;
  code: string;
  hex: string;
}
export function parseLego(html: string): LegoRow[];
export function parseCopic(all: readonly Record<string, unknown>[]): CopicRow[];
export function renderLego(rows: readonly LegoRow[]): string;
export function renderCopic(rows: readonly CopicRow[]): string;
