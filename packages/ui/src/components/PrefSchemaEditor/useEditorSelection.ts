import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { GENERAL } from './generalBranch';
import { nodeAt, parentPath, rebasePaths, type SchemaRoot } from './schemaEdit';

const NONE: readonly string[] = [];

/** The selection after the tree reports `ids`: what stayed keeps its order, and what is new goes last. */
export function nextSelection(prev: readonly string[], ids: Iterable<string>): string[] {
  const now = new Set(ids);
  // General is the root's row, which an empty selection already means.
  now.delete(GENERAL);
  const kept = prev.filter((p) => now.has(p));
  return [...kept, ...[...now].filter((p) => !kept.includes(p))];
}

export function toggled(prev: readonly string[], path: string): string[] {
  return prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
}

/** `paths` that still name a node; `paths` itself when all do. */
export function livePaths(schema: SchemaRoot, paths: readonly string[]): readonly string[] {
  const live = paths.filter((p) => nodeAt(schema, p) !== undefined);
  return live.length === paths.length ? paths : live;
}

const above = (paths: readonly string[]): string[] => {
  const out: string[] = [];
  for (const path of paths) for (let p = parentPath(path); p !== null; p = parentPath(p)) out.push(p);
  return out;
};

export interface EditorSelection {
  /** The selected paths, the newest last. Empty is the root. */
  paths: readonly string[];
  /** The path that stands for the selection where one node must: the newest. `null` is the root. */
  lead: string | null;
  set(paths: readonly string[]): void;
  /** Take what the tree reports. */
  pick(ids: Iterable<string>): void;
  /** Add `path` or take it out, opening the branches above it. */
  toggle(path: string): void;
  rebase(moves: ReadonlyArray<readonly [from: string, to: string]>): void;
  /** Select `paths`, opening the branches above each so the tree shows them. */
  reveal(paths: readonly string[]): void;
}

export function useEditorSelection(schema: SchemaRoot, setExpanded: Dispatch<SetStateAction<Set<string>>>): EditorSelection {
  const [stored, setStored] = useState<readonly string[]>(NONE);
  const paths = useMemo(() => livePaths(schema, stored), [schema, stored]);
  const open = (next: readonly string[]) => setExpanded((e) => new Set([...e, ...above(next)]));
  return {
    paths,
    lead: paths.at(-1) ?? null,
    set: setStored,
    pick: (ids) => setStored((prev) => nextSelection(prev, ids)),
    toggle: (path) => {
      open([path]);
      setStored((prev) => toggled(prev, path));
    },
    rebase: (moves) => setStored((prev) => [...rebasePaths(prev, moves)]),
    reveal: (next) => {
      open(next);
      setStored(next);
    },
  };
}
