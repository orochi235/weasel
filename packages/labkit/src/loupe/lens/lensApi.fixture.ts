import { type Op, type PoseHold, type RectPose, sceneToAdapter } from '@weasel-js/core';
import { vi } from 'vitest';
import { type LensActionApi, MAX_LENSES } from './lensActionDefs';
import { addLensOps, createLensScene, lensesOf } from './lensScene';
import { type LensScene, type LoupePoint, RETICLE_SIZE } from './lensTypes';

export const PIXELS_MISSING = 'Pixels needs Playwright';

/** A host's lens API over a fresh scene, as a test stands one up: lenses added
 *  in order, the latest one current, client points taken as scene points. */
export function lensApiFixture(): LensActionApi<string> & {
  scene: LensScene<string>;
  focus(lensId: string | null): void;
} {
  const scene = createLensScene<string>();
  let n = 0;
  let focused: string | null = null;
  let hold: PoseHold<RectPose> | null = null;
  const apply = (ops: readonly Op[]) => {
    if (ops.length > 0) sceneToAdapter(scene).applyOps([...ops], 'lens');
  };
  const api = {
    scene,
    focus: (lensId: string | null) => {
      focused = lensId;
    },
    current: () => focused ?? lensesOf(scene).at(-1)?.lensId ?? null,
    add: (at?: LoupePoint) => {
      if (lensesOf(scene).length >= MAX_LENSES) return null;
      const lensId = `l${n++}`;
      apply(
        addLensOps(scene, lensId, { body: { x: 300, y: 200 }, reticle: at ?? { x: 100, y: 100 } }),
      );
      return lensId;
    },
    apply,
    follow: (client: LoupePoint) => {
      const lensId = api.current();
      if (lensId === null) return;
      hold ??= scene.overrides.hold();
      const half = RETICLE_SIZE / 2;
      hold.set([
        [
          `${lensId}:reticle` as never,
          { x: client.x - half, y: client.y - half, width: RETICLE_SIZE, height: RETICLE_SIZE },
        ],
      ]);
    },
    sourceAvailable: (kind: string) => (kind === 'pixels' ? PIXELS_MISSING : true) as true | string,
    openCompareMenu: vi.fn(),
  };
  return api;
}
