import { useEffect, useMemo, useRef, useState } from 'react';
import { type CanvasSize, SceneCanvas, useLatest, useScene } from '@weasel-js/core';
import { useElapsedRaf } from '@weasel-js/react';
import { quatFromAxisAngle, type Vec3 } from '@weasel-js/geom/3d';
import {
  POSE3_COMPOSITION, cameraRig, cameraViewProjection, createCamera, createLinePass, packLines,
  pose3, poseMatrix, useOrbitTool, worldPoseOf,
  type Line3, type LinePass, type Pose3,
} from '@weasel-js/kernel3d';
import styles from './Lines3dDemo.module.css';
import { DemoStage } from './DemoStage';

const W = 620, H = 400;
/** One draw-on and drain, in ms. */
const CYCLE = 4000;

interface Polyline { points: Vec3[]; color: Line3['color'] }

const helix: Vec3[] = Array.from({ length: 97 }, (_, i) => {
  const a = (i / 96) * Math.PI * 6;
  return { x: Math.cos(a), y: i / 48, z: Math.sin(a) };
});
const zigzag: Vec3[] = Array.from({ length: 7 }, (_, i) => ({ x: i * 0.6 - 1.8, y: 0, z: i % 2 ? 0.6 : -0.6 }));

const LINES = [
  { kind: 'mark' as const, layer: 'lines' as const, pose: pose3({ x: -1.8, y: 0, z: 0 }), data: { points: helix, color: [0.94, 0.45, 0.3, 1] as const } },
  {
    kind: 'mark' as const, layer: 'lines' as const,
    pose: pose3({ x: 1.6, y: 0.4, z: 0.4 }, { x: 1, y: 1, z: 1 }, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2.5)),
    data: { points: zigzag, color: [0.36, 0.66, 0.94, 1] as const },
  },
];

const GRID: Line3[] = Array.from({ length: 11 }, (_, i) => i - 5).flatMap((i) => [
  { runs: [{ points: [{ x: i, y: 0, z: -5 }, { x: i, y: 0, z: 5 }] }], color: [0.3, 0.25, 0.2, 1] as const, width: 1, head: null },
  { runs: [{ points: [{ x: -5, y: 0, z: i }, { x: 5, y: 0, z: i }] }], color: [0.3, 0.25, 0.2, 1] as const, width: 1, head: null },
]);

export function Lines3dDemo() {
  const scene = useScene<Polyline, 'lines', Pose3>({ composition: POSE3_COMPOSITION, systemLayers: [{ id: 'lines' }], initial: LINES });
  const [camera, setCamera] = useState(() => createCamera({ distance: 9, pitch: 0.5, yaw: 0.5, target: { x: 0, y: 0.8, z: 0 } }));
  const cameraRef = useLatest(camera);
  const size = useRef<CanvasSize>({ width: W, height: H });
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const pass = useRef<{ gl: WebGL2RenderingContext; lines: LinePass } | null>(null);

  useEffect(() => {
    const gl = glCanvas.current?.getContext('webgl2') ?? null;
    if (!gl) return;
    pass.current = { gl, lines: createLinePass(gl) };
    return () => { pass.current?.lines.dispose(); pass.current = null; };
  }, []);

  const loop = useElapsedRaf((elapsed, self) => {
    self.request();
    const target = pass.current;
    const canvas = glCanvas.current;
    if (!target || !canvas) return;
    const { width, height } = size.current;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });
    // 0 → 1 draws the line on from its tail; 1 → 2 drains it into its tip.
    const p = ((elapsed % CYCLE) / CYCLE) * 2;
    const trim = { start: Math.max(0, p - 1), end: Math.min(1, p) };
    const lines: Line3[] = [...GRID, ...scene.renderOrderNodes().filter((n) => n.kind === 'mark').map((n) => ({
      runs: [{ points: n.data.points }], color: n.data.color, width: 4, trim, model: poseMatrix(worldPoseOf(scene, n.id)!),
    }))];
    const { gl } = target;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    target.lines.draw(packLines(lines), cameraViewProjection(cameraRef.current, width / height), size.current, { depthTest: false });
  }, { target: glCanvas });
  useEffect(() => { loop.request(); }, [loop]);

  const rig = useMemo(() => cameraRig({ get: () => cameraRef.current, set: setCamera, size: () => size.current }), [cameraRef]);
  const orbit = useOrbitTool();

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        backgroundFill={{ color: '#1e1610' }}
        scene={scene}
        tools={{ orbit }}
        defaultActiveTool="orbit"
        ambient={[rig]}
        onResize={(next) => { size.current = next; }}
        layers={{ scene: { drawOne: () => [] } }}
      />
      <canvas ref={glCanvas} className={styles.lines} />
    </DemoStage>
  );
}
