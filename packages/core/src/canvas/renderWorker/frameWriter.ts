/**
 * What a frame message carries: each input the worker has not yet been sent, and the scene's
 * changes since the last frame.
 */
import type { Scene } from '../../core/scene/types';
import { resolveDpr } from '../canvasRenderer';
import type { ToWorker } from './protocol';
import { createSceneDiff } from './sceneDiff';
import { wireOverrides, wireScroll } from './sceneMirror';
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

/** Each node whose alpha differs from what `sent` holds, updating `sent` to match. */
function alphaChanges(scene: AnyScene, alphaFor: ((id: string) => number) | undefined, sent: Map<string, number>): [string, number][] {
  const out: [string, number][] = [];
  for (const id of scene.nodes.keys()) {
    const a = alphaFor ? alphaFor(id) : 1;
    if ((sent.get(id) ?? 1) === a) continue;
    out.push([id, a]);
    if (a === 1) sent.delete(id);
    else sent.set(id, a);
  }
  for (const id of sent.keys()) {
    if (scene.nodes.has(id as never)) continue;
    sent.delete(id);
  }
  return out;
}

export function createFrameWriter(): FrameWriter {
  const sent: Partial<Record<'view' | 'layers' | 'cull' | 'extra' | 'size', unknown>> = {};
  const diff = createSceneDiff();
  let sceneVersion = -1;
  let overridesDirty = true;
  let scrollAt = -1;
  /** The alpha last sent per node, holding only those `alphaFor` dims. */
  const alphas = new Map<string, number>();
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
      scrollAt = -1;
      alphas.clear();
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
        // The worker drops every alpha with its scene, so a reset sends them all again.
        if (delta?.reset) alphas.clear();
      }
      if (overridesDirty) {
        overridesDirty = false;
        msg.overrides = wireOverrides(scene);
      }
      if (scene.scroll.getGeneration() !== scrollAt) {
        scrollAt = scene.scroll.getGeneration();
        msg.scroll = wireScroll(scene);
      }
      const alpha = alphaChanges(scene, inputs.alphaFor, alphas);
      if (alpha.length > 0) msg.alpha = alpha;
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
