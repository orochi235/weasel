import { type Op, type PoseHold, type RectPose, sceneToAdapter } from '@weasel-js/core';
import { vi } from 'vitest';
import { type LensActionApi, MAX_LENSES } from './lensActionDefs';
import { addLensOps, aimAt, createLensScene, lensesOf, settingsOf } from './lensScene';
import type { LensScene, LoupePoint } from './lensTypes';

export const PIXELS_MISSING = 'needs Playwright';

/** A host's lens API over a fresh scene, as a test stands one up: lenses added
 *  in order, the latest one current, client points taken as scene points. */
export function lensApiFixture(): LensActionApi<string> & {
  scene: LensScene<string>;
  focus(lensId: string | null): void;
} {
  const scene = createLensScene<string>();
  let n = 0;
  let focused: string | null = null;
  const holds = new Map<string, { hold: PoseHold<RectPose>; aim: string | undefined }>();
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
    follow: (client: LoupePoint, named?: string) => {
      const lensId = named ?? api.current();
      if (lensId === null) return;
      const aimed = aimAt(scene, lensId, client);
      if (aimed === null) return;
      const held = holds.get(lensId) ?? {
        hold: scene.overrides.hold(),
        aim: settingsOf(scene, lensId)?.aim,
      };
      holds.set(lensId, held);
      held.hold.set([[aimed.id as never, aimed.pose]]);
    },
    unfollow: (lensId: string) => {
      holds.get(lensId)?.hold.drop();
      holds.delete(lensId);
    },
    sourceAvailable: (kind: string) => (kind === 'pixels' ? PIXELS_MISSING : true) as true | string,
    openCompareMenu: vi.fn(),
  };
  return api;
}
