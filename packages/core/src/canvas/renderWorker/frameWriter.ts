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
  /** The last frame written never reached the worker: send everything next frame. */
  lost(): void;
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
    // The worker's entry outlives the node, and would dim a node put back under its id.
    out.push([id, 1]);
    sent.delete(id);
  }
  return out;
}

/** Whether any pose override shows data, which the page evaluates against the stored data. */
function showsData(scene: AnyScene): boolean {
  for (const id of scene.overrides.ids()) if (scene.overrides.read(id)?.data) return true;
  return false;
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
  const forgetScene = () => {
    diff.forget();
    sceneVersion = -1;
    overridesDirty = true;
    scrollAt = -1;
    alphas.clear();
  };
  return {
    forgetScene,
    lost() {
      forgetScene();
      for (const key of Object.keys(sent) as (keyof typeof sent)[]) delete sent[key];
    },
    overridesChanged() { overridesDirty = true; },
    write(inputs) {
      const { view, width, height, layerVisibility, layerOrder, cull, extraCommands } = inputs;
      const scene = inputs.scene as AnyScene;
      const msg: FrameMessage = { type: 'frame' };
      const version = scene.getContentVersion();
      let delta: ReturnType<typeof diff.next> = null;
      if (version !== sceneVersion) {
        delta = diff.next(scene);
        sceneVersion = version;
        if (delta) msg.scene = delta;
        // The worker's scene drops its alphas, overrides and scroll offsets on a reset, so a
        // reset sends them all again.
        if (delta?.reset) alphas.clear();
      }
      // An override's shown data is its function of the stored data, which a delta may change.
      if (overridesDirty || delta?.reset || (delta && showsData(scene))) {
        overridesDirty = false;
        msg.overrides = wireOverrides(scene);
      }
      if (scene.scroll.getGeneration() !== scrollAt || delta?.reset) {
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
