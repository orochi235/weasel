import type { ThemeDefinition } from '@weasel-js/theme';
import { axisDependencies, bakeChain, emitCss, serializeDefinition, toDTCG, type Lookup } from '@weasel-js/theme/engine';
import { runtimeTheme } from './model';

export type ExportKind = 'css' | 'definition' | 'dtcg';

export interface ExportFile {
  readonly filename: string;
  readonly type: string;
  readonly text: string;
}

export const EXPORTS: readonly { readonly kind: ExportKind; readonly label: string }[] = [
  { kind: 'css', label: 'Emitted CSS' },
  { kind: 'definition', label: 'Definition' },
  { kind: 'dtcg', label: 'DTCG' },
];

/** The theme and every theme it extends, root first: the order `bakeChain` returns. */
function chainOf(def: ThemeDefinition, lookup: Lookup): ThemeDefinition[] {
  const parent = def.extends ? lookup(def.extends) : undefined;
  return [...(parent ? chainOf(parent, lookup) : []), def];
}

export function exportFile(kind: ExportKind, def: ThemeDefinition, lookup: Lookup): ExportFile {
  if (kind === 'definition') return { filename: `${def.name}.json`, type: 'application/json', text: serializeDefinition(def) };
  if (kind === 'dtcg') {
    return { filename: `${def.name}.tokens.json`, type: 'application/json', text: `${JSON.stringify(toDTCG(runtimeTheme(def, lookup)), null, 2)}\n` };
  }
  const baked = bakeChain(def, lookup);
  const themes = chainOf(def, lookup).map((d, i) => ({ baked: baked[i], deps: axisDependencies(d, lookup), isDefault: i === 0 }));
  return { filename: `${def.name}.tokens.css`, type: 'text/css', text: emitCss(themes) };
}

export function download(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(url);
}
