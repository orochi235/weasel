import {
  type Scene,
  SceneCanvas,
  type SceneCanvasApi,
  type SceneCanvasProps,
} from '@weasel-js/core';
import {
  type ForwardedRef,
  forwardRef,
  type ReactElement,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useTrialHistory } from '../trial/trialHistory';
import { useTrialTitle } from '../trial/trialTitle';
import { editStampsOf, sceneTrialHistory, stampSceneEdits } from './sceneTrialHistory';
import { useSceneCamera } from './useSceneCamera';
import { type TrialToolSlot, useSceneToolSlot } from './useSceneToolSlot';

/** Props for {@link TrialSceneCanvas}: a `<SceneCanvas>`'s, sized by the trial. */
// Distributed, since an `Omit` of the page-or-worker union would merge its two branches.
export type TrialSceneCanvasProps<TData, TLayer extends string, TPose> = (SceneCanvasProps<
  TData,
  TLayer,
  TPose
> extends infer P
  ? P extends unknown
    ? Omit<P, 'width' | 'height' | 'scene'>
    : never
  : never) & {
  /** A live scene — `useTrialScene`'s, usually. */
  scene: Scene<TData, TLayer, TPose>;
  /** The trial it is mounted in, as `render` is handed it. */
  trial: TrialToolSlot;
  /** Whether the trial's Undo and Redo step the scene's history. Default
   *  `true`; the buttons appear only for an instrument declaring `undo`. */
  history?: boolean;
};

function TrialSceneCanvasInner<TData, TLayer extends string, TPose>(
  {
    scene,
    trial,
    history = true,
    onToolsCreated,
    ...rest
  }: TrialSceneCanvasProps<TData, TLayer, TPose>,
  ref: ForwardedRef<SceneCanvasApi>,
) {
  const stamps = editStampsOf(scene);
  useEffect(() => stampSceneEdits(scene, stamps), [scene, stamps]);
  useTrialHistory(
    useMemo(() => (history ? sceneTrialHistory(scene, stamps) : null), [history, scene, stamps]),
  );
  const toolsReported = useSceneToolSlot(trial, onToolsCreated);
  const title = useTrialTitle();
  const api = useRef<SceneCanvasApi | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  useSceneCamera(api, host);
  const both = useCallback(
    (v: SceneCanvasApi | null) => {
      api.current = v;
      if (typeof ref === 'function') ref(v);
      else if (ref) ref.current = v;
    },
    [ref],
  );
  return (
    <div className="lk-trial-scene" ref={host}>
      <SceneCanvas
        aria-label={title ?? undefined}
        {...rest}
        ref={both}
        scene={scene}
        onToolsCreated={toolsReported}
      />
    </div>
  );
}

/**
 * A `<SceneCanvas>` that fills an instrument's trial and takes part in it: the
 * trial's tool slot and the canvas's active tool are one value, and the
 * trial's Undo and Redo — buttons and Mod+Z alike — step the scene's history.
 *
 * Render it from an instrument that declares no `canvas` or `stage`: the scene
 * then owns every pointer, wheel and key gesture over it, its own pan and zoom
 * included, and its view is the trial's camera, which the lab's zoom drives. The trial already mounts
 * the kit's providers isolated from the trial beside it, so it needs no
 * `<WeaselProvider>` of its own.
 */
export const TrialSceneCanvas = forwardRef(TrialSceneCanvasInner) as <
  TData,
  TLayer extends string,
  TPose,
>(
  props: TrialSceneCanvasProps<TData, TLayer, TPose> & { ref?: Ref<SceneCanvasApi> },
) => ReactElement;
