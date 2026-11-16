import type { PresetComponentProps, UseResizeOptions } from '@weasel-js/core';
import { useAreaSelectDepSource } from './areaSelect';
import { useInsertDepSource } from './insert';
import { useLassoSelectDepSource } from './lassoSelect';
import { resizePolicyOptions, useResizePolicy } from './resizePolicy';

/** Publishes the `areaSelect` and `lassoSelect` deps over the canvas's scene, selection and pickers. */
export function RegionSelectDeps({ canvas }: PresetComponentProps) {
  const { pick } = canvas;
  const alphaOf = pick.alphaOf();
  useAreaSelectDepSource(canvas.scene(), canvas.selection(), canvas.poseDescriptor(), alphaOf, pick.reachable, pick.targetOf);
  useLassoSelectDepSource(canvas.scene(), canvas.selection(), canvas.poseDescriptor(), alphaOf, pick.reachable, pick.targetOf);
  return null;
}

/** Publishes the `insert` dep, minting into the canvas's scene with its insert factories. */
export function InsertDeps({ canvas }: PresetComponentProps) {
  useInsertDepSource(canvas.scene(), canvas.adapter(), canvas.insertNodeFactories());
  return null;
}

/** Publishes the `resizePolicy` dep from `<SceneCanvas selectTool.resize>`, when it is given. */
export function ResizePolicyDeps({ canvas }: PresetComponentProps) {
  const resize = canvas.selectTool().resize;
  return resize ? <ResizePolicy options={resize as UseResizeOptions<unknown>} /> : null;
}

function ResizePolicy({ options }: { options: UseResizeOptions<unknown> }) {
  useResizePolicy<unknown>(resizePolicyOptions(options));
  return null;
}
