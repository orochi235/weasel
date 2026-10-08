import { useMemo, useState } from 'react';
import type { PressModifiers } from '../../useReorderDragList';
import type { TreeNode } from './Tree';

export function textOf(node: TreeNode): string {
  return node.textValue ?? (typeof node.label === 'string' ? node.label : '');
}

export function modsOf(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): PressModifiers {
  return { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey };
}

export function useControlledSet(
  value: Iterable<string> | undefined,
  initial: Iterable<string> | undefined,
  onChange: ((ids: Set<string>) => void) | undefined,
): [ReadonlySet<string>, (next: Set<string>) => void] {
  const [own, setOwn] = useState<ReadonlySet<string>>(() => new Set(initial));
  const controlled = useMemo(() => (value === undefined ? undefined : new Set(value)), [value]);
  const set = (next: Set<string>) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  return [controlled ?? own, set];
}
