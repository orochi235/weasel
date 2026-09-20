import {
  composeRigidPose,
  createScene,
  mat3,
  resolveSkeleton,
  RIGID_POSE_COMPOSITION,
  sceneToAdapter,
} from '@weasel-js/core';
import type { Pose, RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { boneLocalPoses } from '../platformer/boneRig';
import { boneId, boneNodes, type WorldData, type WorldLayer } from '../platformer/sceneWorld';
import { FALL, HURT, IDLE, JUMP, POLE, RUN } from '../platformer/clips';
import { BONE_LENGTH, BONE_WIDTH, PLAYER_SKELETON, ROOT_TO_FOOT } from '../platformer/skeleton';

/**
 * The world poses the demo produced when it resolved the rig to matrices and
 * flattened them onto parentless nodes. Kept verbatim as the reference the
 * parented version has to reproduce — a conversion that changes where a limb
 * lands is a regression, and nothing else in the suite would see it.
 */
function flattenedWorld(pose: Pose, at: { x: number; y: number }, facing: 1 | -1) {
  const joints = resolveSkeleton(PLAYER_SKELETON, pose);
  const root = new Float32Array(9) as unknown as Parameters<typeof mat3.multiply>[0];
  root[0] = facing; root[1] = 0; root[2] = 0;
  root[3] = 0; root[4] = 1; root[5] = 0;
  root[6] = at.x; root[7] = at.y - ROOT_TO_FOOT; root[8] = 1;

  const out = new Map<string, RectPose>();
  for (const j of PLAYER_SKELETON.joints) {
    const m = joints.get(j.name);
    if (!m) continue;
    const world = mat3.multiply(root, m);
    const len = BONE_LENGTH[j.name];
    const wid = BONE_WIDTH[j.name];
    const [ox, oy] = mat3.apply(world, 0, 0);
    const [tx, ty] = mat3.apply(world, len, 0);
    out.set(j.name, {
      x: (ox + tx) / 2 - len / 2,
      y: (oy + ty) / 2 - wid / 2,
      width: len,
      height: wid,
      rotation: Math.atan2(ty - oy, tx - ox),
    });
  }
  return out;
}

/** Walk the parent chain the way `buildSceneTree` does, so the comparison is
 *  against the composition the canvas actually applies. */
function composedWorld(locals: Map<string, RectPose>): Map<string, RectPose> {
  const out = new Map<string, RectPose>();
  for (const j of PLAYER_SKELETON.joints) {
    const local = locals.get(j.name);
    if (!local) continue;
    if (j.parent == null) {
      out.set(j.name, local);
      continue;
    }
    const parent = out.get(j.parent);
    if (!parent) throw new Error(`no resolved parent for ${j.name}`);
    out.set(j.name, composeRigidPose(parent, local));
  }
  return out;
}

/**
 * The four corners of a pose's box, sorted, so two poses are compared by the
 * box they draw rather than by their fields.
 *
 * That is the right equivalence here and not a weakening: a bone's box is a
 * rectangle about its own center, so `rotation` and `rotation + PI` draw the
 * same box. Mirroring reverses which end of a bone its joint sits at, and the
 * reference derives its angle from `atan2` over the reversed endpoints — so
 * facing left, the two agree on every corner and differ by PI on the field.
 */
function corners(p: RectPose): number[] {
  const r = p.rotation ?? 0;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const hw = p.width / 2;
  const hh = p.height / 2;
  const pts: Array<[number, number]> = [];
  for (const [dx, dy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as const) {
    pts.push([cx + dx * c - dy * s, cy + dx * s + dy * c]);
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return pts.flat();
}

const POSES: Array<[string, Pose]> = [
  ['idle', IDLE.keys[0].value],
  ['run 0', RUN.keys[0].value],
  ['run 1', RUN.keys[1].value],
  ['jump', JUMP.keys[0].value],
  ['fall', FALL.keys[0].value],
  ['hurt', HURT.keys[0].value],
  ['pole', POLE.keys[0].value],
];

describe('boneLocalPoses', () => {
  for (const [label, pose] of POSES) {
    for (const facing of [1, -1] as const) {
      it(`reproduces the flattened rig for ${label}, facing ${facing}`, () => {
        const at = { x: 137.5, y: 62.25 };
        const expected = flattenedWorld(pose, at, facing);
        const actual = composedWorld(boneLocalPoses(pose, at, facing));

        expect([...actual.keys()]).toEqual([...expected.keys()]);
        for (const [name, want] of expected) {
          const got = actual.get(name)!;
          expect(got.width, `${name}.width`).toBe(want.width);
          expect(got.height, `${name}.height`).toBe(want.height);
          // The reference is the loose side: `mat3` is a `Float32Array`, so a
          // coordinate near 140 carries ~1e-5 of rounding that the composed
          // path, all float64, does not.
          const [gc, wc] = [corners(got), corners(want)];
          for (let i = 0; i < 8; i++) {
            expect(gc[i], `${name} corner ${i}`).toBeCloseTo(wc[i], 3);
          }
        }
      });
    }
  }

  it('mirrors about the root rather than translating', () => {
    const at = { x: 100, y: 50 };
    const right = composedWorld(boneLocalPoses(RUN.keys[0].value, at, 1));
    const left = composedWorld(boneLocalPoses(RUN.keys[0].value, at, -1));
    for (const [name, r] of right) {
      const l = left.get(name)!;
      const rcx = r.x + r.width / 2;
      const lcx = l.x + l.width / 2;
      expect(lcx - at.x, `${name} center x`).toBeCloseTo(at.x - rcx, 6);
      expect(l.y, `${name}.y`).toBeCloseTo(r.y, 6);
    }
  });
});

describe('the bone nodes as the canvas composes them', () => {
  it('resolves each bone to the world pose the flattened rig gave it', () => {
    const scene = createScene<WorldData, WorldLayer, RectPose>({
      systemLayers: [{ id: 'tiles' }, { id: 'entities' }, { id: 'player' }],
    });
    for (const spec of boneNodes()) scene.add(spec);

    const at = { x: 137.5, y: 62.25 };
    const pose = RUN.keys[1].value;
    for (const [name, local] of boneLocalPoses(pose, at, -1)) {
      scene.setPose(boneId(name), local);
    }

    // The adapter is what `<SceneCanvas poseComposition>` builds, so this is
    // the composition the canvas applies rather than a re-derivation of it.
    const adapter = sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION });
    const expected = flattenedWorld(pose, at, -1);
    for (const [name, want] of expected) {
      const got = adapter.getWorldPose(boneId(name)) as RectPose;
      const [gc, wc] = [corners(got), corners(want)];
      for (let i = 0; i < 8; i++) {
        expect(gc[i], `${name} corner ${i}`).toBeCloseTo(wc[i], 3);
      }
    }
  });

  it('parents every bone but the hip, and clips none of them', () => {
    const specs = boneNodes();
    expect(specs).toHaveLength(11);
    expect(specs.filter((n) => n.parent === undefined).map((n) => n.id)).toEqual([boneId('hip')]);
    // A container with no `clipFromPose` clips its descendants to its own
    // silhouette, which for a bone is a box a few units wide.
    for (const n of specs.filter((s) => s.kind === 'container')) {
      expect(n.clipFromPose?.(), `${n.id} clip`).toBeNull();
    }
  });
});
