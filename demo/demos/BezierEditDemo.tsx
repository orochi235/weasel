import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  asNodeId,
  PathBuilder,
  pathPoseDescriptor,
  SceneCanvas,
  countPathAnchors,
  selectFromMarquee,
  useAnimator,
  useScene,
  useSelection,
  tweenVertexColors,
  cycleVertexColors,
  staggerVertexColors,
  rainbowVertexColors,
  solidVertexColors,
} from '@orochi235/weasel';
import type {
  CanvasExtensionApi,
  CycleHandle,
  Path,
  PoseProjection,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

const H = 360, HANDLE = 8;
const ID = 'curve';

// An open S-curve: two cubic segments back to back.
const INITIAL_PATH: Path = new PathBuilder()
  .moveTo(60, 220)
  .curveTo(140, 60, 220, 60, 260, 160)
  .curveTo(300, 260, 380, 260, 420, 100)
  .build();

export function BezierEditDemo() {
  // Pose/data split (a): the Path itself is the pose; data is a degenerate
  // tag. The demo's `Path` already encodes both shape and position, so a
  // separate `{x,y,w,h}` pose would just duplicate work.
  const scene = useScene<{ kind: 'path' }, 'default', Path>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'leaf',
      layer: 'default',
      pose: INITIAL_PATH,
      data: { kind: 'path' },
      id: asNodeId(ID),
    }],
  });
  const selection = useSelection({ initial: [asNodeId(ID)] });
  const animator = useAnimator();

  const [cycleOklch, setCycleOklch] = useState(false);
  const [cycling, setCycling] = useState(true);
  const cycleHandleRef = useRef<CycleHandle | null>(null);

  // Measure container width so the canvas can stretch to the same width as
  // the surrounding code-panel rather than a fixed 720px.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 720);
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // pointInPath only fills closed regions, so an S-curve has no body to hit.
  // Approximate stroke-hit: AABB containment with an 8-px slop.
  const pickEvery = (wx: number, wy: number): string | null => {
    const node = scene.get(asNodeId(ID));
    if (!node) return null;
    const b = pathPoseDescriptor.getBounds(node.pose);
    const slop = 8;
    const inside = wx >= b.x - slop && wx <= b.x + b.width + slop
      && wy >= b.y - slop && wy <= b.y + b.height + slop;
    return inside ? ID : null;
  };

  const appendCurve = () => {
    const node = scene.get(asNodeId(ID));
    if (!node || node.pose.kind !== 'polygon') return;
    const p = node.pose;
    // The trailing pair of coords is the current end of the path
    // (every M/L/C/Q command ends on (x,y)). Append a cubic ~80px to the right.
    const cs = p.coords;
    const ex = cs[cs.length - 2];
    const ey = cs[cs.length - 1];
    const nx = ex + 80;
    const ny = ey + (Math.random() < 0.5 ? -40 : 40);
    const next = PathBuilder.fromPath(p)
      .curveTo(ex + 30, ey - 30, nx - 30, ny - 30, nx, ny)
      .build();
    scene.setPose(asNodeId(ID), next);
  };

  const handleTweenRed = () => {
    const node = scene.get(asNodeId(ID));
    if (!node) return;
    const n = countPathAnchors(node.pose);
    tweenVertexColors(animator, {
      id: ID,
      channel: 'stroke',
      from: rainbowVertexColors(n),
      to: solidVertexColors(n, 1, 0, 0),
      ms: 800,
    });
  };

  const handleStaggerWhite = () => {
    const node = scene.get(asNodeId(ID));
    if (!node) return;
    const n = countPathAnchors(node.pose);
    staggerVertexColors(animator, {
      id: ID,
      channel: 'stroke',
      from: rainbowVertexColors(n),
      to: solidVertexColors(n, 1, 1, 1),
      anchorMs: 400,
      perAnchorDelay: 200,
      origin: 'first',
    });
  };

  // Auto-start the hue cycle so the demo has motion on mount.
  // Restarting on `cycleOklch` toggle keeps the active interpolation in sync.
  useEffect(() => {
    if (!cycling) return;
    cycleHandleRef.current = cycleVertexColors(animator, {
      id: ID,
      channel: 'stroke',
      msPerCycle: 1500,
      interpolation: cycleOklch ? 'oklch' : 'rgb',
    });
    return () => {
      cycleHandleRef.current?.cancel();
      cycleHandleRef.current = null;
    };
  }, [animator, cycling, cycleOklch]);

  // The demo's `drawOne` reads `animator.colorOverrides` per call, but
  // SceneCanvas only repaints on scene mutations — animations don't touch
  // the scene, so without nudging the canvas we'd freeze on the first
  // frame's colors. RAF-poll `animator.isActive()` and request a redraw
  // each frame while any tween / cycle / stagger is in flight.
  const canvasApiRef = useRef<CanvasExtensionApi | null>(null);
  useEffect(() => {
    let raf: number | null = null;
    const tick = () => {
      if (animator.isActive()) canvasApiRef.current?.requestRedraw?.();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf != null) cancelAnimationFrame(raf); };
  }, [animator]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={appendCurve} style={btn} title="Append a cubic segment to the path">
          Add point
        </button>
        <span style={sep} />
        <button
          onClick={() => setCycling((c) => !c)}
          style={cycling ? btnActive : btn}
          title="Loop the rainbow palette around the hue wheel (1.5s per cycle)"
        >
          {cycling ? '⏸ Pause cycle' : '▶ Cycle'}
        </button>
        <label style={checkLabel} title="Interpolate cycle hues in OKLCh space — smoother perceived color transitions than the default RGB lerp">
          <input
            type="checkbox"
            checked={cycleOklch}
            onChange={(e) => setCycleOklch(e.currentTarget.checked)}
          />
          OKLCh
        </label>
        <span style={sep} />
        <button onClick={handleTweenRed} style={btn} title="One-shot tween from the current rainbow → solid red across all anchors (800ms)">
          Tween → red
        </button>
        <button onClick={handleStaggerWhite} style={btn} title="Staggered tween to white — each anchor transitions in sequence with a 200ms delay">
          Stagger → white
        </button>
      </div>
      <div ref={wrapRef} style={{ width: '100%' }}>
        <SceneCanvas
          ref={canvasApiRef}
          width={width}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          geometry={{ pickEvery }}
          selectTool={{
            handleHitRadius: HANDLE,
            resize: { geometry: pathPoseDescriptor as PoseProjection<Path> },
            areaSelect: { behaviors: [selectFromMarquee()] },
          }}
          layers={{
            scene: {
              drawOne: (_o, p): DrawCommand[] => {
                const baseColors = rainbowVertexColors(countPathAnchors(p));
                const override = animator.colorOverrides.get(ID, 'stroke');
                const colors =
                  typeof override === 'function'
                    ? override(baseColors, performance.now())
                    : (override as readonly number[] | undefined) ?? baseColors;
                return [{
                  kind: 'path',
                  path: p,
                  stroke: { paint: { color: '#ffffff' }, width: 5, vertexColors: colors as number[] },
                }];
              },
            },
            selectionOverlay: { handles: { size: HANDLE } },
          }}
        />
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  background: '#2a2018', color: '#d4c4a8',
  border: '1px solid #4a3c2e', borderRadius: 3,
};
const btnActive: React.CSSProperties = {
  ...btn, background: '#7fb069', color: '#1a130d', borderColor: '#7fb069',
};
const sep: React.CSSProperties = {
  display: 'inline-block', width: 1, height: 18,
  background: '#4a3c2e', margin: '0 4px',
};
const checkLabel: React.CSSProperties = {
  fontSize: 12, color: '#d4c4a8', display: 'flex', gap: 4, alignItems: 'center',
};
