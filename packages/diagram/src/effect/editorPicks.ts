/** What `EffectEditor` has picked, a stage, a group, or a wire, and what it hands `DiagramView` as picked. */
import { useLatest } from '@weasel-js/react';
import { useCallback, useState } from 'react';
import type { EditorScene } from './editorMapping';

/** Whether a scene node is a stage or a group: the parts of a drawing a person picks. */
export const isPart = (built: EditorScene, id: string): boolean =>
  built.stageOf(id) !== undefined || built.groupOf(id) !== undefined;

interface Given {
  selected?: string | null | undefined;
  selectedGroup?: string | null | undefined;
  onSelect?: ((stage: string | null, picked: readonly string[]) => void) | undefined;
  onSelectGroup?: ((group: string | null) => void) | undefined;
}

/**
 * Turns `DiagramView`'s picks into stage and group picks. Each of the three
 * is kept here while its prop leaves it uncontrolled, so a controlled
 * `selected` of null does not clear a picked group or wire. `shown` is
 * `undefined` while neither prop is given.
 */
export function useEditorPicks(built: EditorScene, given: Given) {
  const [stage, setStage] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [edge, setEdge] = useState<string | null>(null);
  const latest = useLatest({ built, given });
  const pick = useCallback((id: string | null, ids: readonly string[] = id === null ? [] : [id]) => {
    const { built: b, given: g } = latest.current;
    const s = id === null ? undefined : b.stageOf(id);
    const k = id === null ? undefined : b.groupOf(id);
    setStage(s ?? null);
    setGroup(k ?? null);
    setEdge(id !== null && s === undefined && k === undefined && b.wireOf(id) !== undefined ? id : null);
    g.onSelect?.(s ?? null, ids.filter((i) => isPart(b, i)));
    g.onSelectGroup?.(k ?? null);
  }, [latest]);
  const unpick = useCallback(() => setEdge(null), []);
  const shownStage = given.selected !== undefined ? given.selected : stage;
  const shownGroup = given.selectedGroup !== undefined ? given.selectedGroup : group;
  const wire = edge === null || built.wireOf(edge) === undefined ? null : edge;
  const controlled = given.selected !== undefined || given.selectedGroup !== undefined;
  const live = (id: string | null) => (id !== null && isPart(built, id) ? id : null);
  const shown = controlled ? live(shownStage) ?? live(shownGroup) ?? wire : undefined;
  return { pick, unpick, shown };
}
