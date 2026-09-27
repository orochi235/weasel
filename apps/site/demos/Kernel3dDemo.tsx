import { useMemo, useRef, useState } from 'react';
import {
  PATH_L, PATH_M, PATH_Z, SceneCanvas, solid, useScene,
  type DrawCommand, type RenderLayer, type SurfaceContribution, type ToolsApi,
} from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui';
import { multiply, quatFromAxisAngle, transformPoint4, type Mat4, type Vec3 } from '@weasel-js/geom/3d';
import {
  cameraEye, cameraViewProjection, createCamera, createNodeAtPoint, createPoseDescriptor,
  dollyAction, ndcToScreen, orbitAction, pose3, poseMatrix, useOrbitTool,
  type Camera3d, type Camera3dDep, type Pose3, type Scene3d, type Viewport3d,
} from '@weasel-js/kernel3d';
import styles from './Kernel3dDemo.module.css';

const W = 620, H = 400;
const RECT = { x: 0, y: 0, width: W, height: H };
const LIGHT: Vec3 = { x: 0.4, y: 0.8, z: 0.45 };
const EDGE = { color: '#14100b' };

interface Solid { rgb: readonly [number, number, number] }

const solidAt = (pose: Pose3, rgb: Solid['rgb']) =>
  ({ kind: 'leaf' as const, layer: 'solids' as const, pose, data: { rgb } });

const SOLIDS = [
  solidAt(pose3({ x: -2.2, y: 0.5, z: 0 }), [224, 108, 79]),
  solidAt(pose3({ x: 0, y: 0.7, z: 0 }, { x: 1.4, y: 1.4, z: 1.4 },
    quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 5)), [79, 157, 224]),
  solidAt(pose3({ x: 2.2, y: 0.75, z: -1 }, { x: 1, y: 1.5, z: 1 }), [111, 191, 115]),
];

/** Corner `i` of the unit cube: bit 0 is x, bit 1 is y, bit 2 is z. */
const CORNERS: Vec3[] = Array.from({ length: 8 }, (_, i) => ({
  x: i & 1 ? 0.5 : -0.5, y: i & 2 ? 0.5 : -0.5, z: i & 4 ? 0.5 : -0.5,
}));
const FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];

const toScreen = (m: Mat4, p: Vec3): { x: number; y: number } | null => {
  const [x, y, , w] = transformPoint4(m, p);
  return w > 0.01 ? ndcToScreen({ x: x / w, y: y / w }, RECT) : null;
};

const polygon = (pts: readonly { x: number; y: number }[], close: boolean) => ({
  kind: 'polygon' as const,
  commands: new Uint8Array([PATH_M, ...pts.slice(1).map(() => PATH_L), ...(close ? [PATH_Z] : [])]),
  coords: new Float32Array(pts.flatMap((p) => [p.x, p.y])),
  fillRule: 'nonzero' as const,
});

const hex = (rgb: Solid['rgb'], k: number) =>
  `#${rgb.map((c) => Math.round(Math.min(255, c * k)).toString(16).padStart(2, '0')).join('')}`;

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

function groundGrid(vp: Mat4): DrawCommand[] {
  const out: DrawCommand[] = [];
  for (let i = -5; i <= 5; i++) {
    for (const [a, b] of [[{ x: i, y: 0, z: -5 }, { x: i, y: 0, z: 5 }], [{ x: -5, y: 0, z: i }, { x: 5, y: 0, z: i }]]) {
      const p = toScreen(vp, a), q = toScreen(vp, b);
      if (p && q) out.push({ kind: 'path', path: polygon([p, q], false), stroke: { paint: { color: '#3a2f24' }, width: { px: 1 } } });
    }
  }
  return out;
}

/**
 * The kernel hosts a renderer rather than owning one, so this is the whole
 * renderer: each box's corners through the camera, back faces dropped, boxes
 * painted far to near. Everything else on the page is the kit's own.
 */
function solidsLayer(camera: Camera3d, scene: Scene3d<Solid, 'solids'>): RenderLayer<unknown> {
  const vp = cameraViewProjection(camera, W / H);
  const eye = cameraEye(camera);
  const distance = (p: Pose3) => dot(sub(p.position, eye), sub(p.position, eye));
  return {
    id: 'solids',
    label: 'Solids',
    space: 'screen',
    draw: () => {
      const out = groundGrid(vp);
      const far = [...scene.renderOrderNodes()].sort((a, b) => distance(b.pose) - distance(a.pose));
      for (const { pose, data } of far) {
        const model = poseMatrix(pose);
        const world = CORNERS.map((c) => {
          const [x, y, z] = transformPoint4(model, c);
          return { x, y, z };
        });
        const mvp = multiply(vp, model);
        for (const face of FACES) {
          const center = face.reduce((s, i) => ({ x: s.x + world[i].x / 4, y: s.y + world[i].y / 4, z: s.z + world[i].z / 4 }), { x: 0, y: 0, z: 0 });
          const outward = sub(center, pose.position);
          if (dot(outward, sub(eye, center)) <= 0) continue;
          const pts = face.map((i) => toScreen(mvp, CORNERS[i]));
          if (pts.some((p) => p === null)) continue;
          const lit = Math.max(0, dot(outward, LIGHT) / Math.sqrt(dot(outward, outward)));
          out.push({
            kind: 'path',
            path: polygon(pts as { x: number; y: number }[], true),
            fill: solid(hex(data.rgb, 0.45 + 0.65 * lit)),
            stroke: { paint: EDGE, width: { px: 1 } },
          });
        }
      }
      return out;
    },
  };
}

const deg = (r: number) => ((Math.atan2(Math.sin(r), Math.cos(r)) * 180) / Math.PI).toFixed(1).padStart(6, ' ');

/**
 * Three boxes on a `<SceneCanvas>` whose scene holds `Pose3`s. The kit's own
 * select tool, marquee and selection outline run unchanged: the kernel's
 * `poseDescriptor` answers every bounds question with the box's projected
 * screen rectangle, and its `nodeAtPoint` casts a ray. The view stays at
 * identity, so the kit's world point is the canvas pixel a ray starts from.
 */
export function Kernel3dDemo() {
  const scene = useScene<Solid, 'solids', Pose3>({ systemLayers: [{ id: 'solids' }], initial: SOLIDS });
  const [camera, setCamera] = useState(() =>
    createCamera({ distance: 11, pitch: 0.45, yaw: 0.6, target: { x: 0, y: 0.5, z: 0 } }));
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const world = useMemo(() => ({
    scene,
    viewport: (): Viewport3d => ({ camera: cameraRef.current, width: W, height: H }),
  }), [scene]);
  const poseDescriptor = useMemo(() => createPoseDescriptor(world), [world]);
  const pickEvery = useMemo(() => {
    const nodeAtPoint = createNodeAtPoint(world);
    return (x: number, y: number) => nodeAtPoint({ x, y });
  }, [world]);

  const cameraRig = useMemo((): SurfaceContribution => {
    const camera3d: Camera3dDep = {
      get: () => cameraRef.current,
      set: setCamera,
      size: () => ({ width: W, height: H }),
    };
    return {
      id: 'camera3d',
      eligibility: { always: true },
      actions: [orbitAction, dollyAction],
      deps: { camera3d: () => camera3d },
    };
  }, []);
  const orbit = useOrbitTool();

  const layer = useMemo(() => solidsLayer(camera, scene), [camera, scene]);

  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        {tools && <ToolPalette tools={tools} orientation="horizontal" />}
        <span className={styles.readout}>
          yaw {deg(camera.yaw)}°  pitch {deg(camera.pitch)}°  distance {camera.distance.toFixed(2).padStart(6, ' ')}
        </span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        backgroundFill={{ color: '#1e1610' }}
        scene={scene}
        features={['pick']}
        tools={{ orbit }}
        onToolsCreated={setTools}
        ambient={[cameraRig]}
        poseDescriptor={poseDescriptor}
        geometry={{ pickEvery }}
        layers={{
          // Faces need depth order across nodes, which a per-node painter cannot give.
          scene: { drawOne: () => [] },
          solids: { layer, before: 'scene' },
        }}
      />
    </div>
  );
}
