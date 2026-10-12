/**
 * RotatedResizeMathDemo — pedagogical "what can go wrong with rotated-resize
 * math" explainer. Four parallel rect panels each apply a different
 * `PoseDescriptor` to the SAME drag input, so one corner-drag drives four
 * diverging poses. A fifth panel stacks them at 60% opacity; a sixth panel
 * shows the per-component median of the three broken poses, which recovers
 * green's size and rotation and not its position.
 *
 * ## Post-purge architecture
 *
 * The pre-purge version used the `useResize` hook to instantiate four
 * `ResizeController`s, one per descriptor, and broadcast a single drag to
 * all four. `useResize` is gone; resize math now lives in the dispatcher's
 * `resizeAction` driven by the `resizePolicy` dep.
 *
 * Driving four scenes' dispatchers from one input would require either
 * cross-scene event injection (no clean API) or four mutually-coordinated
 * `selectTool` instances. Both fight the kit's design.
 *
 * **Chosen mechanism:** the demo owns the *routing* of one gesture to four
 * scenes; the gesture itself runs on the kit's `useHandleDrag`. A parent
 * pointerdown handler hit-tests corner handles and captures the start state
 * for all four scenes, then hands the press to `useHandleDrag`, which owns
 * capture, pointer identity and teardown. Each move computes a proposed pose
 * per scene by running the same math the kit's `resizeAction` runs —
 * `computeProposedBounds` + `geometry.remapBounds` + the rotation-pin
 * correction — using each scene's own `PoseDescriptor`, and calls that
 * scene's `setPose`. On release the scenes' batched history captures the
 * gesture.
 *
 * This bypasses `SceneCanvas`'s built-in dispatcher entirely: the four
 * canvases take no `features`, so they are pure renderers.
 * The math is the demo's own (`rotatedResize/math.ts`) because its pedagogy is
 * precisely that math — substituting a broken descriptor for each panel is the
 * whole point. `rotatedResize/panels.tsx` holds the ledger chrome.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  clientToCanvas,
  pointInRotatedRect,
  rotatePoint,
  useHandleDrag,
  useScene,
  cornerResizeHandles,
  hitCornerHandle,
  asNodeId,
} from '@weasel-js/core';
import type { HandleDragEnd, HandleDragPoint, ResizeAnchor } from '@weasel-js/core';
import {
  fixedCornerWorld, HANDLE, INITIAL_GREEN, INITIAL_ORANGE, INITIAL_PURPLE, INITIAL_TEAL,
  PANEL_IDS, PROJECTIONS, runResize, type PanelId, type Rect,
} from './rotatedResize/math';
import { MedianPanel, Panel, StackedOverlayPanel } from './rotatedResize/panels';

interface DragState {
  anchor: ResizeAnchor | null;  // null = body-translate
  startPt: { x: number; y: number };
  startPoses: Record<PanelId, Rect>;
}

export function RotatedResizeMathDemo() {
  const greenScene = useScene<Rect>({ items: [INITIAL_GREEN] });
  const orangeScene = useScene<Rect>({ items: [INITIAL_ORANGE] });
  const purpleScene = useScene<Rect>({ items: [INITIAL_PURPLE] });
  const tealScene = useScene<Rect>({ items: [INITIAL_TEAL] });

  const scenes: Record<PanelId, ReturnType<typeof useScene<Rect>>> = useMemo(() => ({
    green: greenScene, orange: orangeScene, purple: purpleScene, teal: tealScene,
  }), [greenScene, orangeScene, purpleScene, tealScene]);

  // Start state of the gesture in flight, in a ref so the drag callbacks read
  // the current value rather than the render they were created in.
  const dragRef = useRef<DragState | null>(null);

  // Per-panel in-flight pose for the active gesture (null when idle). Lives
  // in React state so panels + overlays re-render on each move, and is
  // mirrored into a ref so the commit reads the CURRENT value.
  const [live, setLive] = useState<Record<PanelId, Rect> | null>(null);
  const liveRef = useRef<Record<PanelId, Rect> | null>(null);
  const updateLive = useCallback((v: Record<PanelId, Rect> | null) => {
    liveRef.current = v;
    setLive(v);
  }, []);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [originFixed, setOriginFixed] = useState<{ x: number; y: number } | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<ResizeAnchor | null>(null);
  // The corner the last resize pinned. Outlives the gesture so the ledger
  // still reads that corner after release, instead of switching to another.
  const [ledgerAnchor, setLedgerAnchor] = useState<ResizeAnchor>({ x: 'min', y: 'min' });

  const COLORS: Record<PanelId, string> = {
    green: INITIAL_GREEN.color,
    orange: INITIAL_ORANGE.color,
    purple: INITIAL_PURPLE.color,
    teal: INITIAL_TEAL.color,
  };
  const ghostColorFor = (panel: PanelId): string =>
    activePanel ? COLORS[activePanel] : COLORS[panel];

  /** Canvas-local coords of a press, or null if it landed outside the canvas. */
  const pressCoords = (
    e: React.PointerEvent,
    wrapper: Element,
  ): { x: number; y: number } | null => {
    const canvas = wrapper.querySelector('canvas');
    if (!canvas) return null;
    const [x, y] = clientToCanvas(canvas, e.clientX, e.clientY);
    const rect = canvas.getBoundingClientRect();
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y };
  };

  const handleMove = useCallback((pt: HandleDragPoint) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = pt.x - drag.startPt.x;
    const dy = pt.y - drag.startPt.y;
    const next: Record<PanelId, Rect> = { ...drag.startPoses };
    if (drag.anchor) {
      for (const panel of PANEL_IDS) {
        next[panel] = runResize(PROJECTIONS[panel], drag.startPoses[panel], drag.anchor, dx, dy);
      }
    } else {
      for (const panel of PANEL_IDS) {
        const p = drag.startPoses[panel];
        next[panel] = { ...p, x: p.x + dx, y: p.y + dy };
      }
    }
    updateLive(next);
  }, [updateLive]);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setActivePanel(null);
    setOriginFixed(null);
    setActiveAnchor(null);
    updateLive(null);
  }, [updateLive]);

  const handleEnd = useCallback(({ moved }: HandleDragEnd) => {
    // Commit each scene's live pose as the new committed pose via batch. Read
    // through the ref, not the `live` state: this closure predates every move
    // of the gesture.
    const finalPoses = liveRef.current;
    if (moved && finalPoses) {
      for (const panel of PANEL_IDS) {
        const scene = scenes[panel];
        const finalPose = finalPoses[panel];
        scene.batch('Resize', () => {
          scene.setPose(asNodeId('a'), finalPose);
        });
      }
    }
    clearDrag();
  }, [clearDrag, scenes]);

  const handleDrag = useHandleDrag<HTMLDivElement>({
    // Coords are canvas-local; the wrapper also holds the caption and ghosts.
    getRect: (wrapper) => wrapper.querySelector('canvas') ?? wrapper,
    onMove: handleMove,
    onEnd: handleEnd,
    onCancel: clearDrag,
  });

  const handlePointerDown = useCallback((panel: PanelId, e: React.PointerEvent<HTMLDivElement>) => {
    const wrapper = e.currentTarget;
    const pt = pressCoords(e, wrapper);
    if (!pt) return;
    // Hit-test handles against the GREEN canonical pose. The four panels
    // start with the same initial pose, so the hit is meaningful even when
    // the user clicks on another panel's wrapper — and we always broadcast
    // to all four scenes regardless of which one started the drag.
    const ref = greenScene.get(asNodeId('a'));
    if (!ref) return;
    const refPose = ref.pose as Rect;
    const cx = refPose.x + refPose.width / 2;
    const cy = refPose.y + refPose.height / 2;
    // Rotate the click into local frame for handle hit-testing.
    const local = rotatePoint(pt.x, pt.y, cx, cy, -refPose.rotation);
    e.stopPropagation();
    e.preventDefault();

    const handles = cornerResizeHandles(refPose);
    let hitAnchor: ResizeAnchor | null = null;
    for (const h of handles) {
      if (hitCornerHandle(h, local.x, local.y, HANDLE)) {
        hitAnchor = h.anchor;
        break;
      }
    }

    const startPoses: Record<PanelId, Rect> = {
      green: greenScene.get(asNodeId('a'))!.pose as Rect,
      orange: orangeScene.get(asNodeId('a'))!.pose as Rect,
      purple: purpleScene.get(asNodeId('a'))!.pose as Rect,
      teal: tealScene.get(asNodeId('a'))!.pose as Rect,
    };

    if (!hitAnchor) {
      // Body-translate only from green (canonical) panel.
      if (panel !== 'green') return;
      if (!pointInRotatedRect(refPose, pt.x, pt.y)) return;
    }

    // Opened before the state below is written: a session still live from a
    // release this page never saw is cancelled here, and its `onCancel` runs
    // `clearDrag` — which would wipe the gesture we are starting.
    handleDrag.onPointerDown(e);

    dragRef.current = { anchor: hitAnchor, startPt: pt, startPoses };
    setActivePanel(panel);
    if (hitAnchor) setActiveAnchor(hitAnchor);
    if (hitAnchor) setLedgerAnchor(hitAnchor);
    if (hitAnchor) setOriginFixed(fixedCornerWorld(refPose, hitAnchor));
    updateLive(startPoses);
  }, [greenScene, orangeScene, purpleScene, tealScene, handleDrag, updateLive]);

  const livePose = (panel: PanelId): Rect | null => live?.[panel] ?? null;
  const displayedPose = (panel: PanelId): Rect => live?.[panel]
    ?? (scenes[panel].get(asNodeId('a'))!.pose as Rect);

  return (
    <div>
      <style>{`
        .rrmd-panel { position: relative; touch-action: none; }
        .rrmd-ghost { position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible; }
        .rrmd-overlay-svg { display: block; pointer-events: none; overflow: visible; }
        .rrmd-caption {
          position: absolute; left: 6px; bottom: 6px;
          padding: 4px 6px; font-size: 11px;
          color: #e8e8e8; background: rgba(0,0,0,0.55);
          border-radius: 3px; pointer-events: none; line-height: 1.3;
        }
        .rrmd-caption-title { font-weight: 600; }
        .rrmd-caption-body { opacity: 0.85; }
        .rrmd-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
      `}</style>
      <header>
        <h2>Rotated resize: the math, with counterexamples</h2>
        <p>
          Resizing a rotated rect requires three coordinated steps, and a
          fourth discipline: keep the rotation property orthogonal to the
          resize. Each panel below runs the same drag against its own
          starting pose, but uses a different <code>PoseDescriptor</code> &mdash;
          three are subverted. Drag any corner handle in the green panel
          and all four rects resize in lockstep, each through its own
          projection, so one input drives four diverging outputs. The
          &ldquo;fixed corner&rdquo; ledger below each panel should stay
          constant in the full-math panel; it drifts in the counterexamples.
        </p>
        <ul>
          <li><strong>Full math (green):</strong> drag projected into local frame, anchor math runs there, position is corrected so the diagonal corner stays pinned, rotation preserved.</li>
          <li><strong>No projection (orange):</strong> drag delta applied in world frame &mdash; rect distorts under rotation.</li>
          <li><strong>No correction (purple):</strong> projection on, but the post-remap fixed-corner correction is a no-op &mdash; the perceived fixed corner drifts.</li>
          <li><strong>Coupled rotation (teal):</strong> remap couples rotation to the AABB diagonal angle &mdash; rect rotates as you resize.</li>
          <li><strong>Live overlay:</strong> all four stacked at 60% opacity so divergence shows as color separation.</li>
          <li><strong>Median panel:</strong> per-component median of orange + purple + teal. Two of the three get each of width, height, and rotation right, so the median recovers size and rotation. Position stays wrong: orange and purple both skip the fixed-corner correction, and outvote teal.</li>
        </ul>
      </header>
      <div className="rrmd-grid">
        <Panel
          title="Full math (drag me)"
          showHandles
          scene={greenScene}
          livePose={livePose('green')}
          ghostColor={ghostColorFor('green')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
          ledgerAnchor={ledgerAnchor}
          onPointerDown={(e) => handlePointerDown('green', e)}
        />
        <Panel
          title="No projection — world-frame delta"
          showHandles={false}
          scene={orangeScene}
          livePose={livePose('orange')}
          ghostColor={ghostColorFor('orange')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
          ledgerAnchor={ledgerAnchor}
        />
        <Panel
          title="No correction — anchor drifts"
          showHandles={false}
          scene={purpleScene}
          livePose={livePose('purple')}
          ghostColor={ghostColorFor('purple')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
          ledgerAnchor={ledgerAnchor}
        />
        <Panel
          title="Coupled rotation — pivot follows size"
          showHandles={false}
          scene={tealScene}
          livePose={livePose('teal')}
          ghostColor={ghostColorFor('teal')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
          ledgerAnchor={ledgerAnchor}
        />
        <StackedOverlayPanel
          poses={{
            green: displayedPose('green'),
            orange: displayedPose('orange'),
            purple: displayedPose('purple'),
            teal: displayedPose('teal'),
          }}
        />
        <MedianPanel
          orange={displayedPose('orange')}
          purple={displayedPose('purple')}
          teal={displayedPose('teal')}
        />
      </div>
    </div>
  );
}

export default RotatedResizeMathDemo;
