import {
  type Scene,
  SceneCanvas,
  type SceneCanvasApi,
  type SceneCanvasProps,
} from '@weasel-js/core';
import { type ForwardedRef, forwardRef, type ReactElement, type Ref } from 'react';
import { useTrialHistory } from '../trial/trialHistory';
import { useTrialTitle } from '../trial/trialTitle';
import { type TrialToolSlot, useSceneToolSlot } from './useSceneToolSlot';

/** Props for {@link TrialSceneCanvas}: a `<SceneCanvas>`'s, sized by the trial. */
export type TrialSceneCanvasProps<TData, TLayer extends string, TPose> = Omit<
  SceneCanvasProps<TData, TLayer, TPose>,
  'width' | 'height' | 'scene'
> & {
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
  useTrialHistory(history ? scene : null);
  const toolsReported = useSceneToolSlot(trial, onToolsCreated);
  const title = useTrialTitle();
  return (
    <div className="lk-trial-scene">
      <SceneCanvas
        aria-label={title ?? undefined}
        {...rest}
        ref={ref}
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
 * included, and the trial's camera is not in play. The trial already mounts
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
