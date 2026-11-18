/** The key a selected node is stored under, as the attributes pane edits it. */
import { useState } from 'react';
import { isPrefLeaf } from '@weasel-js/prefs';
import {
  keyFromName, keyOf, keyProblem, keysTakenAt, nodeAt, parentPath, type SchemaNode, type SchemaRoot, takesDottedKey, uniqueKey,
} from '@weasel-js/prefs/edit';

/** The key typed for the node at `path`, and what is wrong with it; both start over when `path` changes. */
export function useKeyDraft(path: string | null) {
  const [key, setKey] = useState(path === null ? '' : keyOf(path));
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setKey(path === null ? '' : keyOf(path));
    setError(null);
  }
  return { key, setKey, error, setError };
}

/** Why `node`, at `path`, cannot be stored under `key`; `null` when it can. */
export function keyProblemFor(schema: SchemaRoot, path: string, node: SchemaNode, key: string): string | null {
  const parent = parentPath(path);
  const host = nodeAt(schema, parent)!;
  return keyProblem(keysTakenAt(schema, parent, isPrefLeaf(node)), key, takesDottedKey(host, node)) || null;
}

/** The key `node`, at `path`, takes from its name; `null` when it keeps the one it has. */
export function followedKeyFor(schema: SchemaRoot, path: string, node: SchemaNode): string | null {
  const parent = parentPath(path);
  const host = nodeAt(schema, parent)!;
  const next = keyFromName(node.name);
  if (takesDottedKey(host, node) || next === '' || next === keyOf(path)) return null;
  return uniqueKey(keysTakenAt(schema, parent, isPrefLeaf(node)), next);
}
