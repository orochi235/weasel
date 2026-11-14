/**
 * The lab's selection: React state, behind the shape the `selection` dep and
 * the kernel's factories read.
 */

import { useMemo, useState } from 'react';
import type { NodeId } from '@weasel-js/routing';
import { useLatest } from '@weasel-js/react';

type Modifiers = { shift: boolean; meta: boolean; ctrl: boolean };

export function useSolidSelection() {
  const [selection, setSelection] = useState<readonly NodeId[]>([]);
  const selectionRef = useLatest(selection);
  const selectionApi = useMemo(
    () => ({
      get current() {
        return selectionRef.current;
      },
      get: () => [...selectionRef.current],
      set: (ids: NodeId[]) => setSelection(ids),
      add: (id: NodeId) => setSelection((prev) => (prev.includes(id) ? prev : [...prev, id])),
      remove: (id: NodeId) => setSelection((prev) => prev.filter((x) => x !== id)),
      clear: () => setSelection([]),
      toggle: (id: NodeId) =>
        setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      contains: (id: NodeId) => selectionRef.current.includes(id),
      applyClick: (id: NodeId, modifiers: Modifiers) =>
        setSelection((prev) => {
          if (!modifiers.shift) return [id];
          return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        }),
      intentOf: (modifiers: Modifiers) => (modifiers.shift ? 'toggle' as const : 'replace' as const),
      adapterMethods: {
        getSelection: () => [...selectionRef.current],
        setSelection: (ids: NodeId[]) => setSelection(ids),
      },
    }),
    [selectionRef],
  );
  return { selection, setSelection, selectionRef, selectionApi };
}
