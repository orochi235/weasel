/**
 * What a frame message carries: each input the worker has not yet been sent, and the scene's
 * changes since the last frame.
 */
import type { Scene } from '../../core/scene/types';
import { resolveDpr } from '../canvasRenderer';
import type { ToWorker } from './protocol';
import { createSceneDiff } from './sceneDiff';
import { wireOverrides } from './sceneMirror';
import type { SceneRenderInputs } from './startSceneRenderWorker';

type FrameMessage = Extract<ToWorker, { type: 'frame' }>;
type AnyScene = Scene<unknown, string, unknown>;

export interface FrameWriter {
  /** The next frame for `inputs`. */
  write(inputs: SceneRenderInputs<unknown, string, unknown>): FrameMessage;
  /** Send the scene whole next frame, as for a new scene. */
  forgetScene(): void;
  /** Send the pose overrides next frame. */
  overridesChanged(): void;
}

export function createFrameWriter(): FrameWriter {
  const sent: Partial<Record<'view' | 'layers' | 'cull' | 'extra' | 'size', unknown>> = {};
  const diff = createSceneDiff();
  let sceneVersion = -1;
  let overridesDirty = true;
  const changed = (key: keyof typeof sent, value: unknown): boolean => {
    if (key in sent && sent[key] === value) return false;
    sent[key] = value;
    return true;
  };
  return {
    forgetScene() {
      diff.forget();
      sceneVersion = -1;
      overridesDirty = true;
    },
    overridesChanged() { overridesDirty = true; },
    write(inputs) {
      const { view, width, height, layerVisibility, layerOrder, cull, extraCommands } = inputs;
      const scene = inputs.scene as AnyScene;
      const msg: FrameMessage = { type: 'frame' };
      const version = scene.getContentVersion();
      if (version !== sceneVersion) {
        const delta = diff.next(scene);
        sceneVersion = version;
        if (delta) msg.scene = delta;
      }
      if (overridesDirty) {
        overridesDirty = false;
        msg.overrides = wireOverrides(scene);
      }
      if (changed('view', view)) msg.view = view;
      const dpr = resolveDpr(inputs.dpr);
      if (changed('size', `${width}x${height}@${dpr}`)) msg.size = { width, height, dpr };
      if (changed('layers', `${JSON.stringify(layerVisibility ?? null)}|${JSON.stringify(layerOrder ?? null)}`)) {
        msg.layers = { layerVisibility, layerOrder };
      }
      if (changed('cull', cull === true)) msg.cull = cull === true;
      if (changed('extra', extraCommands)) msg.extraCommands = extraCommands ? [...extraCommands] : null;
      return msg;
    },
  };
}
