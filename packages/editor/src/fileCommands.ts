import { useCommand, type BoundGesture, type CommandOptions } from '@weasel-js/core';

/** The keys a file command binds unless its caller names others: Cmd/Ctrl+N, O and S. */
export const FILE_KEYS = {
  new: { kind: 'key', key: 'n', mods: { mod: true } },
  open: { kind: 'key', key: 'o', mods: { mod: true } },
  save: { kind: 'key', key: 's', mods: { mod: true } },
} as const satisfies Record<string, BoundGesture>;

/** A file command's options. Leaving `keys` out binds its `FILE_KEYS` entry; `null` binds none. */
export interface FileCommandOptions extends Omit<CommandOptions, 'keys'> {
  keys?: CommandOptions['keys'] | null;
}

type FileRun = (params?: Readonly<Record<string, unknown>>) => void;

function useFileCommand(
  slot: keyof typeof FILE_KEYS, id: string, label: string, run: FileRun, options: FileCommandOptions | undefined,
): void {
  const { keys, ...rest } = options ?? {};
  useCommand(id, label, run, keys === null ? rest : { ...rest, keys: keys ?? FILE_KEYS[slot] });
}

/** `useCommand` for a document's New, bound to Cmd/Ctrl+N by default. */
export function useNewCommand(id: string, label: string, run: FileRun, options?: FileCommandOptions): void {
  useFileCommand('new', id, label, run, options);
}

/** `useCommand` for a document's Open, bound to Cmd/Ctrl+O by default. */
export function useOpenCommand(id: string, label: string, run: FileRun, options?: FileCommandOptions): void {
  useFileCommand('open', id, label, run, options);
}

/** `useCommand` for a document's Save, bound to Cmd/Ctrl+S by default. */
export function useSaveCommand(id: string, label: string, run: FileRun, options?: FileCommandOptions): void {
  useFileCommand('save', id, label, run, options);
}
