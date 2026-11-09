/**
 * A label's scene as an `.lbx` file.
 */
import {
  commandRasterizer,
  createRasterSession,
  holdImageBitmaps,
  planPixelRender,
  viewToMat3,
  warmRender,
  type RenderSceneToPixelsArgs,
} from '@weasel-js/core';
import type { Tape } from '../tape';
import { writeLbx, type LbxResult, type WriteLbxOptions } from './writeLbx';

/** What {@link sceneToLbx} takes: the label's place in its scene, and what `renderSceneToPixels` takes besides its rect and scale. */
export type SceneToLbxArgs<TData, TLayer extends string, TPose> = Omit<
  RenderSceneToPixelsArgs<TData, TLayer, TPose>,
  'sourceRect' | 'scale' | 'background' | 'gl' | 'createCanvas'
> & {
  /** Length along the tape, in points: the label's width in the scene. */
  length: number;
  tape: Tape;
  /** The label's top-left corner in the scene. Default `(0, 0)`. */
  origin?: { x: number; y: number };
  autoLength?: boolean;
  cuts?: readonly number[];
  rasterDpi?: WriteLbxOptions['rasterDpi'];
};

/**
 * Write the label at `origin` in `scene` as an `.lbx` file, drawn the way the canvas draws it
 * (`drawOne` included). What the file cannot state as an object is drawn through a raster session
 * of its own and placed as an image, so this needs WebGL2 where the scene has any.
 */
export async function sceneToLbx<TData, TLayer extends string, TPose>(
  args: SceneToLbxArgs<TData, TLayer, TPose>,
): Promise<LbxResult> {
  const { length, tape, origin = { x: 0, y: 0 }, autoLength, cuts, rasterDpi, ...render } = args;
  const plan = { ...render, sourceRect: { x: origin.x, y: origin.y, width: length, height: tape.widthPt }, scale: { x: 1, y: 1 } };
  await warmRender({ render: plan });
  const { commands, view } = planPixelRender(plan);
  const session = createRasterSession();
  // The commands hold bitmaps across the write's awaits.
  const release = holdImageBitmaps();
  try {
    return await writeLbx(
      { length, tape, commands, view: viewToMat3(view), autoLength, cuts },
      { rasterize: commandRasterizer(session), rasterDpi },
    );
  } finally {
    release();
    session.dispose();
  }
}
