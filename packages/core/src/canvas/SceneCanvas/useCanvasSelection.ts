import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useLatest } from '@weasel-js/react';
import type { SelectionApi } from '@weasel-js/routing';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { useLegalSelection } from 'core/selection/legalSelection';
import { readOnlySelection } from 'core/selection/readOnlySelection';
import type { SelectionFactory } from 'core/selection/selectionContract';
import { usePublishSceneSelection } from 'core/selection/usePublishSceneSelection';
import { viewerSelection } from 'core/selection/viewerSelection';
import type { SceneCanvasProps } from './props';

/**
 * The canvas's selection, published to any surrounding selection context.
 *
 * A caller-supplied api wins. Otherwise an enabled preset's factory builds one over the scene, so the
 * selection an edit was made under rides on the scene's history entries and undo can put it back; with no
 * preset building one, the canvas keeps a selection nothing it runs writes (`viewerSelection`).
 * `selectionOptions.initial` seeds an empty scene either way.
 *
 * Everything the kit writes selection through (the `selection` dep, the adapter's `setSelection`, ops
 * committed through either) reads the returned api, so on an unselectable canvas every write path here is
 * closed. A caller's api kept off the scene holds what the scene's own selection would: only outermost ids
 * on every write, and a node an edit removes, hides or locks is dropped from it as the scene drops it from its
 * own. The caller's own api otherwise still writes as it did.
 */
export function useCanvasSelection<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  props: Pick<SceneCanvasProps<TData, TLayer, TPose>, 'selection' | 'selectionOptions' | 'describeKind'>;
  selectable: boolean;
  /** The canvas's routing kind, published for each node unless `describeKind` is given. */
  kindOf: ((node: { kind: string; data: TData }) => string) | undefined;
  /** What an enabled preset builds the canvas's own selection with. */
  factory?: SelectionFactory;
}): SelectionApi {
  const { scene, selectable, kindOf, factory } = args;
  const { selection: supplied, selectionOptions: options, describeKind } = args.props;
  const describe = useMemo(() => describeKind ?? (kindOf && ((node: Node<TData, TLayer, TPose>) => {
    const kind = kindOf(node);
    return kind === 'unknown' ? undefined : kind;
  })), [describeKind, kindOf]);
  const live = useLatest(options ?? {});
  const own = useMemo(() => (factory ? factory(scene, () => live.current) : viewerSelection(scene)), [factory, scene, live]);
  useSyncExternalStore(scene.subscribe, () => scene.getSelection());
  useSeed(scene, options?.initial);
  const base = useLegalSelection(supplied ?? own, scene);
  const selection = selectable ? base : readOnlySelection(base);
  usePublishSceneSelection(scene, selection.current as readonly NodeId[], describe);
  return selection;
}

/** Seed an empty `scene` with `initial`, once per scene: a scene that already holds a selection keeps it. In a
 *  layout effect, not during render, since the scene has other subscribers. */
function useSeed(scene: Scene<unknown, string, unknown> | Scene<never, never, never>, initial: readonly NodeId[] | undefined): void {
  const first = useRef(initial);
  const seeded = useRef<unknown>(null);
  useLayoutEffect(() => {
    if (seeded.current === scene) return;
    seeded.current = scene;
    const ids = first.current;
    if (ids && ids.length > 0 && scene.getSelection().length === 0) scene.setSelection([...ids]);
  }, [scene]);
}
