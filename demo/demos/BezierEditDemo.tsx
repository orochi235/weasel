import { useEffect, useLayoutEffect, useRef, useState } from 'react';
// `useRef` retained for the wrapper-div measurement; the demo no longer
// needs a ref into SceneCanvas — the new `animator` prop drives redraws.
import {
  asNodeId,
  DEFAULT_HANDLE_SIZE,
  PathBuilder,
  pathToAnchors,
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
} from '@weasel-js/core';
import type {
  CycleHandle,
  Path,
  PolygonPath,
} from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';

const H = 360, HANDLE = DEFAULT_HANDLE_SIZE;
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
  // Lock selection to the demo's one curve — this is a focused demo
  // of path editing, so a stray click on empty workspace shouldn't
  // deselect (which would also exit edit mode).
  const selection = useSelection({ initial: [asNodeId(ID)], lock: true });
  const animator = useAnimator();

  const [cycleOklch, setCycleOklch] = useState(false);
  const [cycling, setCycling] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(5);
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

  // E2E test probe: expose the live anchor/handle snapshot derived from the
  // path pose. Source of truth is `scene.get(ID).pose`, so we read it lazily
  // inside the probe (no ref mirror needed) and clone via JSON for a frozen
  // snapshot. Flat across subpaths since the demo uses a single open path.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hook = window.__weaselTest;
    if (!hook) return;
    return hook.registerProbe('handles', () => {
      const node = scene.get(asNodeId(ID));
      if (!node || node.pose.kind !== 'polygon') return [];
      const { anchors } = pathToAnchors(node.pose as PolygonPath);
      const flat = anchors.flat();
      const out = flat.map((a, vertexIndex) => ({
        vertexIndex,
        anchor: [a.x, a.y] as [number, number],
        handleIn: a.inHandle ? ([a.inHandle.x, a.inHandle.y] as [number, number]) : undefined,
        handleOut: a.outHandle ? ([a.outHandle.x, a.outHandle.y] as [number, number]) : undefined,
      }));
      return JSON.parse(JSON.stringify(out));
    });
  }, [scene]);

  // Auto-start the hue cycle so the demo has motion on mount.
  // Restarting on `cycleOklch` toggle keeps the active interpolation in sync.
  useEffect(() => {
    if (!cycling) return;
    cycleHandleRef.current = cycleVertexColors(animator, {
      id: ID,
      channel: 'stroke',
      msPerCycle: 4000,
      direction: -1,
      interpolation: cycleOklch ? 'oklch' : 'rgb',
    });
    return () => {
      cycleHandleRef.current?.cancel();
      cycleHandleRef.current = null;
    };
  }, [animator, cycling, cycleOklch]);


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
        <span style={sep} />
        <label style={checkLabel} title="Stroke width in pixels">
          Width
          <input
            type="range"
            min={3}
            max={20}
            step={1}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(e.currentTarget.valueAsNumber)}
            style={{ width: 80 }}
          />
          <span style={{ width: 22, textAlign: 'right' }}>{strokeWidth}px</span>
        </label>
      </div>
      <div ref={wrapRef} style={{ width: '100%' }}>
        <SceneCanvas
          width={width}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          animator={animator}
          selectTool={{
            handleHitRadius: HANDLE,
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
                  stroke: { paint: { color: '#ffffff' }, width: strokeWidth, vertexColors: colors as number[] },
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
