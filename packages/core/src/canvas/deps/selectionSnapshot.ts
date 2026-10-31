/**
 * The `selectionSnapshot` dep: the node selection and, in path edit, the anchor
 * selection, captured together, so the last operation puts both back before it
 * reruns an action that changed them.
 */
import type { SelectionSnapshotDep } from '@weasel-js/routing';
import { useDepRegistry, useDepSource } from '@weasel-js/routing/react';
import type {} from '../../interactions/actions/depSchema';

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

export function useSelectionSnapshotDepSource(): void {
  const registry = useDepRegistry();
  useDepSource('selectionSnapshot', (): SelectionSnapshotDep => ({
    take() {
      const ids = registry.get('selection')?.get() ?? null;
      const edit = registry.get('editAnchors');
      const editing = edit?.editingId ?? '';
      const anchors = edit ? [...edit.selectedAnchors] : [];
      return () => {
        const selection = registry.get('selection');
        if (ids && selection && !sameIds(selection.get(), ids)) selection.set([...ids] as never);
        const now = registry.get('editAnchors');
        if (editing && now?.editingId === editing) now.setSelectedAnchors(anchors);
      };
    },
  }));
}
