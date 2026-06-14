# WebGL Features Showcase Demos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four demos under a new "Paint & shading" registry category that showcase the WebGL transition's gradient paint variants, per-vertex path coloring, group-level color matrices, and the experimental custom shader API. One small kit API addition (`shaders` prop on `Canvas` / `SceneCanvas`) unblocks the shader demo.

**Architecture:** Each demo lives in `demo/demos/` and is registered in `demo/registry.ts`. Demos that use only consumer-facing `Paint` (gradients) wire through the existing `scene.drawOne` path; demos that use `DrawCommand`-only fields (`vertexColors`, `colorMatrix`) emit DrawCommands through a custom `RenderLayer` slotted into `SceneCanvas`'s `layers` prop (the same pattern `QuadtreeDemo` uses). The `CustomShaderDemo` registers programs at module scope via `registerProgram()` and threads handles into the renderer through a new `shaders` prop on `Canvas` and `SceneCanvas`.

**Tech Stack:** TypeScript, React, Vite (with `?raw` imports for demo source display), `@weasel-js/core` (kit public surface), `@weasel-js/gl` (renderer types and helpers — `DrawCommand`, `viewToMat3`, `registerProgram`, `registerTexture`, `ShaderProgramHandle`, `ShaderUniform`, `TextureHandle`). Tests use Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-09-webgl-features-demos-design.md`. Note: the spec said "no kit API changes"; that's amended here — Task 1 adds the `shaders` prop to enable the custom shader demo (the rest of the demos make zero kit changes).

---

## File Structure

**Created:**
- `demo/demos/GradientPlaygroundDemo.tsx`
- `demo/demos/VertexColorsDemo.tsx`
- `demo/demos/ColorMatrixDemo.tsx`
- `demo/demos/CustomShaderDemo.tsx`
- `demo/demos/__tests__/GradientPlaygroundDemo.test.tsx`
- `demo/demos/__tests__/VertexColorsDemo.test.tsx`
- `demo/demos/__tests__/ColorMatrixDemo.test.tsx`
- `demo/demos/__tests__/CustomShaderDemo.test.tsx`
- `demo/assets/weasel-mark.png` (moved from repo root `weasel-transparent.cleaned.png`)

**Modified:**
- `src/canvas/Canvas.tsx` — add `shaders?: ShaderProgramHandle[]` prop; register on renderer init
- `src/canvas/SceneCanvas.tsx` — pass-through `shaders` prop
- `src/canvas/Canvas.test.tsx` — coverage for the new prop (forwarded shape only; jsdom can't compile GL)
- `demo/registry.ts` — four new entries

---

## Task 1: Add `shaders` prop to Canvas and SceneCanvas

**Files:**
- Modify: `src/canvas/Canvas.tsx` (props interface + renderer init)
- Modify: `src/canvas/SceneCanvas.tsx` (pass-through)
- Modify: `src/canvas/Canvas.test.tsx` (new test case)

The renderer is currently private to `Canvas`. Consumers of `registerProgram()` need a way to call `WeaselRenderer.registerProgram(handle)` so their shader gets compiled on the live GL context. We add a `shaders?: ShaderProgramHandle[]` prop that triggers that call after renderer instantiation.

- [ ] **Step 1.1: Read the current Canvas props interface and find the renderer init site**

```bash
grep -n "interface CanvasProps\|interface SceneCanvasProps\|new WeaselRenderer\|glRendererRef.current = renderer" src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx
```

Expected: locate the props type for `Canvas`, the props type for `SceneCanvas`, and the line `glRendererRef.current = renderer;` inside `Canvas.tsx` (around line 1049 today).

- [ ] **Step 1.2: Write a failing test asserting `shaders` prop is accepted on SceneCanvas and Canvas**

Add to `src/canvas/Canvas.test.tsx`:

```tsx
import { registerProgram } from '@weasel-js/gl';

describe('Canvas shaders prop', () => {
  it('accepts a shaders array and renders without throwing', () => {
    const handle = registerProgram(
      `test-shader-${Math.random()}`,
      '',
      `#version 300 es
       precision highp float;
       out vec4 outColor;
       void main() { outColor = vec4(0.0, 0.0, 0.0, 1.0); }`,
    );
    // SceneCanvas pass-through — uses Canvas internally.
    const { container } = render(
      <SceneCanvas
        width={100}
        height={100}
        shaders={[handle]}
        scene={emptyScene()}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
```

(`emptyScene()` should follow whatever fixture pattern other tests in this file use — read the existing test setup before writing.)

- [ ] **Step 1.3: Run the new test, verify it fails**

```bash
pnpm vitest run src/canvas/Canvas.test.tsx -t "shaders prop"
```

Expected: FAIL — `shaders` is not a known prop on `SceneCanvas` or `Canvas`.

- [ ] **Step 1.4: Add `shaders` prop to `Canvas`**

In `src/canvas/Canvas.tsx`:

1. Add the import at the top (or extend the existing `@weasel-js/gl` import):
   ```tsx
   import { WeaselRenderer, viewToMat3, type DrawCommand, type ShaderProgramHandle } from '@weasel-js/gl';
   ```
2. Add `shaders?: ShaderProgramHandle[]` to the Canvas props interface. Document it:
   ```tsx
   /**
    * Custom shader programs to compile on the renderer. Each handle must come
    * from a module-level `registerProgram()` call. Compiled once per handle id
    * on first render (or on context restore). Pass a stable reference (e.g.
    * defined at module scope) — the array is read at renderer init time.
    */
   shaders?: ShaderProgramHandle[];
   ```
3. Destructure `shaders` from props alongside the others.
4. After `glRendererRef.current = renderer;` (the renderer-instantiation block, around line 1049), append:
   ```tsx
   if (shaders) {
     for (const handle of shaders) {
       try {
         renderer.registerProgram(handle);
       } catch (e) {
         console.warn(`Canvas: failed to register shader "${handle.id}":`, e);
       }
     }
   }
   ```
5. Add a `useEffect` to re-register if the `shaders` array reference changes after mount:
   ```tsx
   useEffect(() => {
     const renderer = glRendererRef.current;
     if (!renderer || !shaders) return;
     for (const handle of shaders) {
       try {
         renderer.registerProgram(handle);
       } catch (e) {
         console.warn(`Canvas: failed to register shader "${handle.id}":`, e);
       }
     }
   }, [shaders]);
   ```

(`WeaselRenderer.registerProgram` is idempotent at the source-registry level but recompiles each call — that's acceptable for an `@experimental` surface; consumers should pass a memoized/module-scoped array.)

- [ ] **Step 1.5: Add pass-through to `SceneCanvas`**

In `src/canvas/SceneCanvas.tsx`:

1. Add `shaders?: ShaderProgramHandle[]` to the `SceneCanvasProps` interface (import the type from `@weasel-js/gl`).
2. Destructure it from props.
3. Forward it to the inner `<Canvas ... shaders={shaders} />`.

- [ ] **Step 1.6: Run the test, verify it passes**

```bash
pnpm vitest run src/canvas/Canvas.test.tsx -t "shaders prop"
```

Expected: PASS.

- [ ] **Step 1.7: Run the full Canvas test suite to confirm no regression**

```bash
pnpm vitest run src/canvas/Canvas.test.tsx
```

Expected: all green.

- [ ] **Step 1.8: Typecheck and full test run**

```bash
pnpm tsc --noEmit && pnpm vitest run
```

Expected: clean.

- [ ] **Step 1.9: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): add shaders prop for custom shader registration"
```

---

## Task 2: GradientPlaygroundDemo

**Files:**
- Create: `demo/demos/GradientPlaygroundDemo.tsx`
- Create: `demo/demos/__tests__/GradientPlaygroundDemo.test.tsx`
- Modify: `demo/registry.ts`

A single rounded-rect shape on a canvas, filled with one of `linear-gradient | radial-gradient | conic-gradient`. Variant tabs at top, on-canvas drag handles for the active variant's geometry, stop strip below the canvas for adding/moving/recoloring/deleting stops.

- [ ] **Step 2.1: Read the existing simple-demo pattern and the SceneCanvas surface**

```bash
sed -n '1,80p' demo/demos/MoveDemo.tsx
sed -n '1,80p' demo/demos/SceneDemo.tsx
```

Expected: confirm the shape — `useScene`, `<SceneCanvas className="ckd-canvas" ... />`, scene defined inline, `drawOne` returning `DrawCommand[]`.

- [ ] **Step 2.2: Write a smoke test**

Create `demo/demos/__tests__/GradientPlaygroundDemo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { GradientPlaygroundDemo } from '../GradientPlaygroundDemo';

describe('GradientPlaygroundDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<GradientPlaygroundDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('switches between gradient variants without throwing', () => {
    const { getByText, container } = render(<GradientPlaygroundDemo />);
    fireEvent.click(getByText('Radial'));
    fireEvent.click(getByText('Conic'));
    fireEvent.click(getByText('Linear'));
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
```

- [ ] **Step 2.3: Run the test, verify it fails (no module)**

```bash
pnpm vitest run demo/demos/__tests__/GradientPlaygroundDemo.test.tsx
```

Expected: FAIL — `Cannot find module '../GradientPlaygroundDemo'`.

- [ ] **Step 2.4: Implement the demo**

Create `demo/demos/GradientPlaygroundDemo.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { Paint } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/gl';

const W = 600;
const H = 400;

type Variant = 'linear-gradient' | 'radial-gradient' | 'conic-gradient';

interface Stop { offset: number; color: string; }

interface VariantState {
  linear: { from: { x: number; y: number }; to: { x: number; y: number } };
  radial: { center: { x: number; y: number }; radius: number };
  conic:  { center: { x: number; y: number }; angle: number };
  stops: Stop[];
}

const DEFAULT_STOPS: Stop[] = [
  { offset: 0,    color: '#0fb5a8' },
  { offset: 0.55, color: '#c84edb' },
  { offset: 1,    color: '#f4c43c' },
];

const SHAPE_RECT = { x: 80, y: 60, width: W - 160, height: H - 120 };

export function GradientPlaygroundDemo() {
  const [variant, setVariant] = useState<Variant>('linear-gradient');
  const [state, setState] = useState<VariantState>({
    linear: { from: { x: 100, y: 80 }, to: { x: W - 100, y: H - 80 } },
    radial: { center: { x: W / 2, y: H / 2 }, radius: 160 },
    conic:  { center: { x: W / 2, y: H / 2 }, angle: 0 },
    stops:  DEFAULT_STOPS,
  });

  const paint: Paint = useMemo(() => {
    if (variant === 'linear-gradient') {
      return { fill: 'linear-gradient', from: state.linear.from, to: state.linear.to, stops: state.stops };
    }
    if (variant === 'radial-gradient') {
      return { fill: 'radial-gradient', center: state.radial.center, radius: state.radial.radius, stops: state.stops };
    }
    return { fill: 'conic-gradient', center: state.conic.center, angle: state.conic.angle, stops: state.stops };
  }, [variant, state]);

  const scene = useScene<{ paint: Paint }>(() => ({
    nodes: [{ id: 'shape', pose: SHAPE_RECT, data: { paint } }],
  }));

  // Sync scene paint when state changes (re-emits scene.setData; for an
  // even simpler alternative, hold paint in a ref and rely on React to drive
  // the scene re-render via a state bump).
  // Read existing demos for the canonical "live data on a useScene node" pattern.

  return (
    <div className="ckd-stack">
      <Tabs value={variant} onChange={setVariant} />
      <div style={{ position: 'relative', width: W, height: H }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: {
              drawOne: (_node, p): DrawCommand[] => [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: paint,
              }],
            },
          }}
        />
        <HandleOverlay variant={variant} state={state} setState={setState} width={W} height={H} />
      </div>
      <StopStrip stops={state.stops} setStops={(stops) => setState((s) => ({ ...s, stops }))} />
    </div>
  );
}

function Tabs({ value, onChange }: { value: Variant; onChange: (v: Variant) => void }) {
  const opts: { id: Variant; label: string }[] = [
    { id: 'linear-gradient', label: 'Linear' },
    { id: 'radial-gradient', label: 'Radial' },
    { id: 'conic-gradient',  label: 'Conic' },
  ];
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      {opts.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding: '6px 12px',
            background: value === o.id ? '#3a3a3a' : 'transparent',
            color: '#ddd',
            border: '1px solid #555',
            cursor: 'pointer',
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

function HandleOverlay({
  variant, state, setState, width, height,
}: {
  variant: Variant;
  state: VariantState;
  setState: (s: VariantState | ((prev: VariantState) => VariantState)) => void;
  width: number;
  height: number;
}) {
  // SVG overlay positioned absolutely over the canvas.
  // Each handle is a circle; pointerdown captures, pointermove updates state,
  // pointerup releases. Coordinates are in canvas (world) space.

  function startDrag(e: React.PointerEvent, onMove: (x: number, y: number) => void) {
    e.preventDefault();
    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);
    const svg = target.ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    const move = (ev: PointerEvent) => onMove(ev.clientX - rect.left, ev.clientY - rect.top);
    const up = () => {
      target.removeEventListener('pointermove', move as EventListener);
      target.removeEventListener('pointerup', up);
      target.releasePointerCapture(e.pointerId);
    };
    target.addEventListener('pointermove', move as EventListener);
    target.addEventListener('pointerup', up);
  }

  const handleProps = {
    r: 7,
    fill: '#fff',
    stroke: '#222',
    strokeWidth: 2,
    style: { cursor: 'grab' as const },
  };

  if (variant === 'linear-gradient') {
    const { from, to } = state.linear;
    return (
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#fff" strokeOpacity={0.6} strokeDasharray="4 4" />
        <circle
          {...handleProps}
          cx={from.x}
          cy={from.y}
          style={{ ...handleProps.style, pointerEvents: 'auto' }}
          onPointerDown={(e) => startDrag(e, (x, y) =>
            setState((s) => ({ ...s, linear: { ...s.linear, from: { x, y } } })))}
        />
        <circle
          {...handleProps}
          cx={to.x}
          cy={to.y}
          style={{ ...handleProps.style, pointerEvents: 'auto' }}
          onPointerDown={(e) => startDrag(e, (x, y) =>
            setState((s) => ({ ...s, linear: { ...s.linear, to: { x, y } } })))}
        />
      </svg>
    );
  }

  if (variant === 'radial-gradient') {
    const { center, radius } = state.radial;
    const edge = { x: center.x + radius, y: center.y };
    return (
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#fff" strokeOpacity={0.4} strokeDasharray="4 4" />
        <circle
          {...handleProps}
          cx={center.x}
          cy={center.y}
          style={{ ...handleProps.style, pointerEvents: 'auto' }}
          onPointerDown={(e) => startDrag(e, (x, y) =>
            setState((s) => ({ ...s, radial: { ...s.radial, center: { x, y } } })))}
        />
        <circle
          {...handleProps}
          cx={edge.x}
          cy={edge.y}
          style={{ ...handleProps.style, pointerEvents: 'auto' }}
          onPointerDown={(e) => startDrag(e, (x, y) => {
            const dx = x - state.radial.center.x;
            const dy = y - state.radial.center.y;
            setState((s) => ({ ...s, radial: { ...s.radial, radius: Math.max(8, Math.hypot(dx, dy)) } }));
          })}
        />
      </svg>
    );
  }

  // conic
  const { center, angle } = state.conic;
  const tip = { x: center.x + Math.cos(angle) * 80, y: center.y + Math.sin(angle) * 80 };
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <line x1={center.x} y1={center.y} x2={tip.x} y2={tip.y} stroke="#fff" strokeOpacity={0.6} strokeDasharray="4 4" />
      <circle
        {...handleProps}
        cx={center.x}
        cy={center.y}
        style={{ ...handleProps.style, pointerEvents: 'auto' }}
        onPointerDown={(e) => startDrag(e, (x, y) =>
          setState((s) => ({ ...s, conic: { ...s.conic, center: { x, y } } })))}
      />
      <circle
        {...handleProps}
        cx={tip.x}
        cy={tip.y}
        style={{ ...handleProps.style, pointerEvents: 'auto' }}
        onPointerDown={(e) => startDrag(e, (x, y) => {
          const dx = x - state.conic.center.x;
          const dy = y - state.conic.center.y;
          setState((s) => ({ ...s, conic: { ...s.conic, angle: Math.atan2(dy, dx) } }));
        })}
      />
    </svg>
  );
}

function StopStrip({
  stops, setStops,
}: {
  stops: Stop[];
  setStops: (s: Stop[]) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const STRIP_W = W;

  function bgStyle(): React.CSSProperties {
    const css = `linear-gradient(to right, ${stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`;
    return { background: css };
  }

  function onStripClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== stripRef.current) return;
    const rect = stripRef.current!.getBoundingClientRect();
    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    // Interpolate color from neighbors at this offset.
    const sorted = [...stops].sort((a, b) => a.offset - b.offset);
    let lo = sorted[0], hi = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (offset >= sorted[i].offset && offset <= sorted[i + 1].offset) {
        lo = sorted[i]; hi = sorted[i + 1];
        break;
      }
    }
    const t = (offset - lo.offset) / Math.max(1e-6, hi.offset - lo.offset);
    const color = lerpHex(lo.color, hi.color, t);
    setStops([...sorted, { offset, color }].sort((a, b) => a.offset - b.offset));
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div
        ref={stripRef}
        onClick={onStripClick}
        style={{
          width: STRIP_W,
          height: 28,
          border: '1px solid #555',
          position: 'relative',
          ...bgStyle(),
        }}
      >
        {stops.map((s, i) => (
          <StopHandle
            key={i}
            stop={s}
            stripWidth={STRIP_W}
            onMove={(offset) => {
              const next = stops.map((x, j) => j === i ? { ...x, offset: clamp01(offset) } : x);
              setStops(next.sort((a, b) => a.offset - b.offset));
            }}
            onRecolor={(color) => {
              const next = stops.map((x, j) => j === i ? { ...x, color } : x);
              setStops(next);
            }}
            onDelete={() => {
              if (stops.length <= 2) return;
              setStops(stops.filter((_, j) => j !== i));
            }}
          />
        ))}
      </div>
      <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
        Click the strip to add a stop · drag to move · click swatch to recolor · right-click or × to delete
      </small>
    </div>
  );
}

function StopHandle({
  stop, stripWidth, onMove, onRecolor, onDelete,
}: {
  stop: Stop; stripWidth: number;
  onMove: (offset: number) => void;
  onRecolor: (color: string) => void;
  onDelete: () => void;
}) {
  const colorRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); onDelete(); }}
      style={{
        position: 'absolute',
        top: 0,
        left: stop.offset * stripWidth - 8,
        width: 16,
        height: 28,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        const stripEl = (e.currentTarget.parentElement as HTMLElement);
        const rect = stripEl.getBoundingClientRect();
        const move = (ev: PointerEvent) => {
          onMove((ev.clientX - rect.left) / rect.width);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); colorRef.current?.click(); }}
        style={{
          width: 16, height: 28, background: stop.color, border: '2px solid #fff', cursor: 'grab',
        }}
      />
      <input
        ref={colorRef}
        type="color"
        value={normalizeHex(stop.color)}
        onChange={(e) => onRecolor(e.target.value)}
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}
      />
    </div>
  );
}

function lerpHex(a: string, b: string, t: number): string {
  const ac = hexToRgb(a), bc = hexToRgb(b);
  const r = Math.round(ac.r + (bc.r - ac.r) * t);
  const g = Math.round(ac.g + (bc.g - ac.g) * t);
  const bl = Math.round(ac.b + (bc.b - ac.b) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
function hexToRgb(h: string): { r: number; g: number; b: number } {
  const s = normalizeHex(h).slice(1);
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}
function normalizeHex(h: string): string {
  if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return h;
}
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
```

A few notes on the implementation above:

- The scene's `drawOne` reads the closed-over `paint`, which updates on each render — this works because React re-runs the SceneCanvas render. If you find the canvas isn't repainting on state changes, follow the pattern existing demos use to bump the scene (e.g. `scene.setData('shape', { paint })` from a `useEffect`).
- The handle overlay uses an SVG layer above the canvas with `pointer-events: none` on the SVG itself and `pointer-events: auto` on each handle. This lets clicks pass through empty space to the canvas.
- The stop strip uses native `<input type="color">` — a hidden input triggered programmatically by clicking the swatch.

- [ ] **Step 2.5: Run the smoke test, verify it passes**

```bash
pnpm vitest run demo/demos/__tests__/GradientPlaygroundDemo.test.tsx
```

Expected: PASS.

- [ ] **Step 2.6: Add to demo registry**

In `demo/registry.ts`:

1. Add the import:
   ```tsx
   import { GradientPlaygroundDemo } from './demos/GradientPlaygroundDemo';
   import GradientPlaygroundDemoFull from './demos/GradientPlaygroundDemo.tsx?raw';
   ```
2. Add an entry in `DEMOS`:
   ```tsx
   {
     id: 'gradient-playground',
     title: 'Gradient playground',
     category: 'Paint & shading',
     description: 'Interactive editor for the three gradient paint variants — linear, radial, conic. Drag the on-canvas handles to set the gradient geometry (linear endpoints, radial center+radius, conic center+angle). Below the canvas, click the strip to add a stop, drag stops to reposition, click a swatch to recolor, right-click to delete. Showcases the `linear-gradient` / `radial-gradient` / `conic-gradient` Paint variants shipped with the WebGL backend.',
     Component: GradientPlaygroundDemo,
     full: GradientPlaygroundDemoFull,
     path: 'demo/demos/GradientPlaygroundDemo.tsx',
   },
   ```

- [ ] **Step 2.7: Verify demo renders in browser**

```bash
pnpm dev
```

Open the demo app, navigate to "Paint & shading → Gradient playground". Verify:
- All three variant tabs work
- Handles drag smoothly and the gradient updates
- Stop strip lets you add/move/recolor/delete stops
- Default 3-stop teal→magenta→gold gradient appears on first load

Note: dev-server browser verification can't be automated by an agent — the implementer should run this and report observations. If you cannot run a browser, say so explicitly rather than claiming success.

- [ ] **Step 2.8: Typecheck**

```bash
pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 2.9: Commit**

```bash
git add demo/demos/GradientPlaygroundDemo.tsx demo/demos/__tests__/GradientPlaygroundDemo.test.tsx demo/registry.ts
git commit -m "feat(demo): gradient playground for linear/radial/conic paints"
```

---

## Task 3: VertexColorsDemo

**Files:**
- Create: `demo/demos/VertexColorsDemo.tsx`
- Create: `demo/demos/__tests__/VertexColorsDemo.test.tsx`
- Modify: `demo/registry.ts`

A heptagon polygon. Each vertex has a position handle and a color swatch. The fill uses `vertexColors` (RGBA per vertex, length = 4 × vertexCount), so colors interpolate across the triangulated interior. Emitted via a custom `RenderLayer` slotted into `SceneCanvas`'s `layers` map (the QuadtreeDemo pattern).

- [ ] **Step 3.1: Read the QuadtreeDemo custom-layer pattern**

```bash
sed -n '1,60p' demo/demos/QuadtreeDemo.tsx
```

Expected: understand `createQuadtreeLayer` returning a `RenderLayer<unknown>` with a `draw(_data, view)` that returns `DrawCommand[]`, including a top-level `kind: 'group', transform: viewToMat3(view), children: [...]` envelope so world-space coordinates are projected correctly.

- [ ] **Step 3.2: Write a smoke test**

Create `demo/demos/__tests__/VertexColorsDemo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VertexColorsDemo } from '../VertexColorsDemo';

describe('VertexColorsDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<VertexColorsDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
```

- [ ] **Step 3.3: Run the test, verify it fails**

```bash
pnpm vitest run demo/demos/__tests__/VertexColorsDemo.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3.4: Implement the demo**

Create `demo/demos/VertexColorsDemo.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { SceneCanvas, useScene, polygonFromPoints } from '@weasel-js/core';
import type { RenderLayer } from '@weasel-js/core';
import { viewToMat3, type DrawCommand } from '@weasel-js/gl';

const W = 600;
const H = 400;
const N = 7;

interface Vertex { x: number; y: number; rgba: [number, number, number, number]; }

const RAINBOW: [number, number, number, number][] = [
  [1.0, 0.2, 0.3, 1.0],
  [1.0, 0.6, 0.1, 1.0],
  [1.0, 0.9, 0.2, 1.0],
  [0.3, 0.9, 0.4, 1.0],
  [0.2, 0.7, 0.95, 1.0],
  [0.4, 0.4, 0.95, 1.0],
  [0.7, 0.3, 0.9, 1.0],
];

function makeHeptagon(): Vertex[] {
  const cx = W / 2, cy = H / 2, r = 140;
  return Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return {
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      rgba: RAINBOW[i % RAINBOW.length],
    };
  });
}

export function VertexColorsDemo() {
  const [verts, setVerts] = useState<Vertex[]>(makeHeptagon);
  const [showHandles, setShowHandles] = useState(true);

  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: 'vertex-colored-poly',
    label: 'Vertex-colored polygon',
    draw: (_data, view) => {
      const path = polygonFromPoints(verts.map((v) => ({ x: v.x, y: v.y })));
      const colors = verts.flatMap((v) => v.rgba);
      const cmd: DrawCommand = {
        kind: 'path',
        path,
        // No fill — vertexColors carries the per-vertex tint.
        vertexColors: colors,
      };
      return [{ kind: 'group', transform: viewToMat3(view), children: [cmd] }];
    },
  }), [verts]);

  // Empty scene; the rendering happens in the custom layer.
  const scene = useScene<unknown>(() => ({ nodes: [] }));

  return (
    <div className="ckd-stack">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <label style={{ color: '#ddd' }}>
          <input type="checkbox" checked={showHandles} onChange={(e) => setShowHandles(e.target.checked)} />
          {' '}show handles
        </label>
        <button onClick={() => setVerts(makeHeptagon())} style={{ padding: '4px 10px' }}>Reset</button>
      </div>
      <div style={{ position: 'relative', width: W, height: H }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            poly: { layer, after: 'scene' },
          }}
        />
        {showHandles && (
          <Handles verts={verts} setVerts={setVerts} width={W} height={H} />
        )}
      </div>
    </div>
  );
}

function Handles({
  verts, setVerts, width, height,
}: {
  verts: Vertex[];
  setVerts: (v: Vertex[] | ((prev: Vertex[]) => Vertex[])) => void;
  width: number;
  height: number;
}) {
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {verts.map((v, i) => (
        <VertexHandle
          key={i}
          v={v}
          onMove={(x, y) => setVerts((prev) => prev.map((p, j) => j === i ? { ...p, x, y } : p))}
          onRecolor={(rgba) => setVerts((prev) => prev.map((p, j) => j === i ? { ...p, rgba } : p))}
        />
      ))}
    </svg>
  );
}

function VertexHandle({
  v, onMove, onRecolor,
}: {
  v: Vertex;
  onMove: (x: number, y: number) => void;
  onRecolor: (rgba: [number, number, number, number]) => void;
}) {
  const swatchHex = rgbaToHex(v.rgba);
  return (
    <g style={{ pointerEvents: 'auto' }}>
      <circle
        cx={v.x}
        cy={v.y}
        r={9}
        fill={swatchHex}
        stroke="#fff"
        strokeWidth={2}
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => {
          e.preventDefault();
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          const svg = target.ownerSVGElement!;
          const rect = svg.getBoundingClientRect();
          const move = (ev: PointerEvent) => onMove(ev.clientX - rect.left, ev.clientY - rect.top);
          const up = () => {
            target.removeEventListener('pointermove', move as EventListener);
            target.removeEventListener('pointerup', up);
          };
          target.addEventListener('pointermove', move as EventListener);
          target.addEventListener('pointerup', up);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          // Trigger native color picker via a hidden input in the document body.
          const input = document.createElement('input');
          input.type = 'color';
          input.value = swatchHex;
          input.onchange = () => onRecolor(hexToRgba(input.value));
          input.click();
        }}
      />
    </g>
  );
}

function rgbaToHex(rgba: [number, number, number, number]): string {
  const [r, g, b] = rgba;
  const f = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
function hexToRgba(h: string): [number, number, number, number] {
  const s = h.slice(1);
  return [
    parseInt(s.slice(0, 2), 16) / 255,
    parseInt(s.slice(2, 4), 16) / 255,
    parseInt(s.slice(4, 6), 16) / 255,
    1.0,
  ];
}
```

Notes:

- The kit emits `vertexColors` as a flat RGBA array of length `4 × vertexCount`. The order matches `polygonFromPoints` ordering. If the renderer triangulates the polygon, the colors interpolate across triangles automatically — that's the whole point of this demo.
- Double-click a vertex to recolor (single-click drags). If single-click-recolor is desired instead, swap the gestures. Document the interaction in the description.

- [ ] **Step 3.5: Run the test, verify it passes**

```bash
pnpm vitest run demo/demos/__tests__/VertexColorsDemo.test.tsx
```

Expected: PASS.

- [ ] **Step 3.6: Add to demo registry**

In `demo/registry.ts`:

```tsx
import { VertexColorsDemo } from './demos/VertexColorsDemo';
import VertexColorsDemoFull from './demos/VertexColorsDemo.tsx?raw';
```

Add to `DEMOS`:

```tsx
{
  id: 'vertex-colors',
  title: 'Per-vertex colors',
  category: 'Paint & shading',
  description: 'A heptagon whose fill is driven by an RGBA-per-vertex array — no Paint object, just colors baked onto the geometry. Drag a vertex handle to move it; double-click to recolor. Colors interpolate smoothly across the triangulated interior. Demonstrates the `vertexColors` field on `PathDrawCommand`, emitted from a custom `RenderLayer` slotted into the Canvas layers map.',
  Component: VertexColorsDemo,
  full: VertexColorsDemoFull,
  path: 'demo/demos/VertexColorsDemo.tsx',
},
```

- [ ] **Step 3.7: Verify in browser**

```bash
pnpm dev
```

Navigate to "Paint & shading → Per-vertex colors". Verify the polygon renders with the rainbow palette, vertices drag, and double-click opens a color picker.

- [ ] **Step 3.8: Typecheck and commit**

```bash
pnpm tsc --noEmit
git add demo/demos/VertexColorsDemo.tsx demo/demos/__tests__/VertexColorsDemo.test.tsx demo/registry.ts
git commit -m "feat(demo): per-vertex path coloring"
```

---

## Task 4: ColorMatrixDemo

**Files:**
- Create: `demo/demos/ColorMatrixDemo.tsx`
- Create: `demo/demos/__tests__/ColorMatrixDemo.test.tsx`
- Modify: `demo/registry.ts`

Three nested groups, each with its own preset color matrix. Inside each group are three colored circles forming a base palette. Preset buttons swap the matrix on a chosen group; the cumulative effect (multiplicative down the stack) is visible because deeper leaves see all three matrices composed.

- [ ] **Step 4.1: Confirm color-matrix is on `GroupDrawCommand`**

```bash
grep -n "colorMatrix" src/renderer/DrawCommand.ts
```

Expected: see `colorMatrix?: number[]` on `GroupDrawCommand` (4×5 row-major, 20 numbers).

- [ ] **Step 4.2: Write a smoke test**

Create `demo/demos/__tests__/ColorMatrixDemo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ColorMatrixDemo } from '../ColorMatrixDemo';

describe('ColorMatrixDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<ColorMatrixDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
  it('preset clicks do not throw', () => {
    const { getAllByText } = render(<ColorMatrixDemo />);
    const sepias = getAllByText('Sepia');
    fireEvent.click(sepias[0]);
    fireEvent.click(getAllByText('Identity')[0]);
  });
});
```

- [ ] **Step 4.3: Run the test, verify it fails**

```bash
pnpm vitest run demo/demos/__tests__/ColorMatrixDemo.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4.4: Implement the demo**

Create `demo/demos/ColorMatrixDemo.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { RenderLayer } from '@weasel-js/core';
import { viewToMat3, type DrawCommand } from '@weasel-js/gl';

const W = 720;
const H = 360;

type PresetName = 'Identity' | 'Grayscale' | 'Sepia' | 'Invert' | 'Hue+90°' | 'Brightness×1.5';

const PRESETS: Record<PresetName, number[]> = {
  // 4×5 row-major: [r-row(rgba+bias), g-row, b-row, a-row]
  'Identity':       [1,0,0,0,0,  0,1,0,0,0,  0,0,1,0,0,  0,0,0,1,0],
  // Luminance grayscale (BT.601)
  'Grayscale':      [0.299,0.587,0.114,0,0,  0.299,0.587,0.114,0,0,  0.299,0.587,0.114,0,0,  0,0,0,1,0],
  'Sepia':          [0.393,0.769,0.189,0,0,  0.349,0.686,0.168,0,0,  0.272,0.534,0.131,0,0,  0,0,0,1,0],
  'Invert':         [-1,0,0,0,1,  0,-1,0,0,1,  0,0,-1,0,1,  0,0,0,1,0],
  'Hue+90°':        hueRotate(Math.PI / 2),
  'Brightness×1.5': [1.5,0,0,0,0,  0,1.5,0,0,0,  0,0,1.5,0,0,  0,0,0,1,0],
};

function hueRotate(rad: number): number[] {
  // Standard hue-rotation matrix (luminance-preserving approximation).
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const lr = 0.213, lg = 0.715, lb = 0.072;
  return [
    lr + cos * (1 - lr) - sin * lr,       lg - cos * lg - sin * lg,             lb - cos * lb + sin * (1 - lb),       0, 0,
    lr - cos * lr + sin * 0.143,          lg + cos * (1 - lg) + sin * 0.140,    lb - cos * lb - sin * 0.283,          0, 0,
    lr - cos * lr - sin * (1 - lr),       lg - cos * lg + sin * lg,             lb + cos * (1 - lb) + sin * lb,       0, 0,
    0, 0, 0, 1, 0,
  ];
}

const PRESET_NAMES: PresetName[] = ['Identity', 'Grayscale', 'Sepia', 'Invert', 'Hue+90°', 'Brightness×1.5'];

interface GroupConfig { id: 'outer' | 'middle' | 'inner'; preset: PresetName; offsetX: number; }

const BASE_PALETTE: { x: number; y: number; r: number; color: string }[] = [
  { x: 30,  y: 60, r: 22, color: '#ee5a4a' },
  { x: 80,  y: 60, r: 22, color: '#5ad07f' },
  { x: 130, y: 60, r: 22, color: '#4f7fff' },
];

export function ColorMatrixDemo() {
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: 'outer',  preset: 'Identity', offsetX: 0   },
    { id: 'middle', preset: 'Sepia',    offsetX: 240 },
    { id: 'inner',  preset: 'Hue+90°',  offsetX: 480 },
  ]);

  function setPreset(id: GroupConfig['id'], preset: PresetName) {
    setGroups((g) => g.map((x) => x.id === id ? { ...x, preset } : x));
  }

  const layer: RenderLayer<unknown> = useMemo(() => {
    const drawPalette = (offsetX: number): DrawCommand[] => BASE_PALETTE.map((p) => ({
      kind: 'path',
      path: { kind: 'rect', x: offsetX + p.x - p.r, y: p.y - p.r, width: p.r * 2, height: p.r * 2 },
      fill: { color: p.color },
    }));
    return {
      id: 'color-matrix-stack',
      label: 'Color matrix stack',
      draw: (_data, view) => {
        // Outer wraps everything; its leaves draw at offsetX=0; middle wraps middle+inner; inner draws its own.
        const outer = groups[0], middle = groups[1], inner = groups[2];
        return [{
          kind: 'group',
          transform: viewToMat3(view),
          children: [{
            kind: 'group',
            colorMatrix: PRESETS[outer.preset],
            children: [
              ...drawPalette(outer.offsetX),
              {
                kind: 'group',
                colorMatrix: PRESETS[middle.preset],
                children: [
                  ...drawPalette(middle.offsetX),
                  {
                    kind: 'group',
                    colorMatrix: PRESETS[inner.preset],
                    children: drawPalette(inner.offsetX),
                  },
                ],
              },
            ],
          }],
        }];
      },
    };
  }, [groups]);

  const scene = useScene<unknown>(() => ({ nodes: [] }));

  return (
    <div className="ckd-stack">
      <div style={{ position: 'relative', width: W, height: H }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            stack: { layer, after: 'scene' },
          }}
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
        {groups.map((g) => (
          <PresetRow
            key={g.id}
            label={g.id}
            value={g.preset}
            onChange={(p) => setPreset(g.id, p)}
          />
        ))}
      </div>
      <small style={{ color: '#888', marginTop: 8 }}>
        Each group&apos;s color matrix multiplies into the next. Inner-group leaves see all three matrices composed.
      </small>
    </div>
  );
}

function PresetRow({
  label, value, onChange,
}: {
  label: string; value: PresetName; onChange: (p: PresetName) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <strong style={{ color: '#ddd', textTransform: 'capitalize' }}>{label}</strong>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PRESET_NAMES.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              background: value === p ? '#3a3a3a' : 'transparent',
              color: '#ddd',
              border: '1px solid #555',
              cursor: 'pointer',
            }}
          >{p}</button>
        ))}
      </div>
    </div>
  );
}
```

Notes:

- The `hueRotate` matrix is an approximation; the standard SVG `feColorMatrix` "hueRotate" formula is what shipped in many reference implementations. If the visual result looks off in browser, double-check against MDN's feColorMatrix hue-rotate matrix.
- The bias column is the 5th element of each row (indices 4, 9, 14, 19); `Invert` uses bias = 1 to flip into [0,1] range.

- [ ] **Step 4.5: Run tests**

```bash
pnpm vitest run demo/demos/__tests__/ColorMatrixDemo.test.tsx
```

Expected: PASS.

- [ ] **Step 4.6: Add to demo registry**

```tsx
import { ColorMatrixDemo } from './demos/ColorMatrixDemo';
import ColorMatrixDemoFull from './demos/ColorMatrixDemo.tsx?raw';
```

```tsx
{
  id: 'color-matrix',
  title: 'Stacked color matrices',
  category: 'Paint & shading',
  description: 'Three nested groups, each with its own preset color matrix (Identity / Grayscale / Sepia / Invert / Hue+90° / Brightness×1.5). The same base palette renders inside each group, so you can see the cumulative effect — inner-group leaves see all three matrices composed multiplicatively. Click a preset button under any group to swap that group\'s matrix and watch the entire subtree retint. Demonstrates `GroupDrawCommand.colorMatrix`.',
  Component: ColorMatrixDemo,
  full: ColorMatrixDemoFull,
  path: 'demo/demos/ColorMatrixDemo.tsx',
},
```

- [ ] **Step 4.7: Browser verify, typecheck, commit**

```bash
pnpm dev    # navigate to "Paint & shading → Stacked color matrices", verify presets work
pnpm tsc --noEmit
git add demo/demos/ColorMatrixDemo.tsx demo/demos/__tests__/ColorMatrixDemo.test.tsx demo/registry.ts
git commit -m "feat(demo): stacked color matrices on nested groups"
```

---

## Task 5: CustomShaderDemo

**Files:**
- Create: `demo/demos/CustomShaderDemo.tsx`
- Create: `demo/demos/__tests__/CustomShaderDemo.test.tsx`
- Create: `demo/assets/weasel-mark.png` (move from repo root `weasel-transparent.cleaned.png`)
- Modify: `demo/registry.ts`

Three side-by-side shader panels: plasma, ripple-on-image, voronoi. Each panel runs its own `ShaderDrawCommand` over a panel-bound rect. Programs are registered at module scope. The demo passes the program handles into `SceneCanvas` via the new `shaders` prop.

- [ ] **Step 5.1: Move and register the image asset**

```bash
mkdir -p demo/assets
git mv weasel-transparent.cleaned.png demo/assets/weasel-mark.png 2>/dev/null \
  || mv weasel-transparent.cleaned.png demo/assets/weasel-mark.png
ls demo/assets/
```

(If `weasel-transparent.cleaned.png` is already deleted or renamed, substitute any small PNG — even a 256×256 placeholder is fine; the demo just needs an image to sample.)

- [ ] **Step 5.2: Smoke test**

Create `demo/demos/__tests__/CustomShaderDemo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CustomShaderDemo } from '../CustomShaderDemo';

describe('CustomShaderDemo', () => {
  it('mounts without throwing', () => {
    const { container } = render(<CustomShaderDemo />);
    // Three shader panels — each should produce a canvas.
    expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 5.3: Run, verify it fails**

```bash
pnpm vitest run demo/demos/__tests__/CustomShaderDemo.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 5.4: Implement the demo**

Create `demo/demos/CustomShaderDemo.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { RenderLayer } from '@weasel-js/core';
import {
  registerProgram, registerTexture, viewToMat3,
  type DrawCommand, type ShaderProgramHandle, type TextureHandle,
} from '@weasel-js/gl';
import weaselMarkUrl from '../assets/weasel-mark.png';

const PANEL_W = 240;
const PANEL_H = 240;
const TOTAL_W = PANEL_W * 3 + 24; // 8px gap × 2

// --- Shaders -----------------------------------------------------------------

const PLASMA_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform vec2  u_mouse;  // 0..1, panel-local
out vec4 outColor;
void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  float t = u_time;
  float v = sin(p.x * 4.0 + t) + sin(p.y * 4.0 + t * 1.3)
          + sin((p.x + u_mouse.x * 2.0 - 1.0) * 6.0 + t * 0.7)
          + sin(length(p - (u_mouse * 2.0 - 1.0)) * 8.0 - t * 1.1);
  v *= 0.25;
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.66) + v));
  outColor = vec4(col, 1.0);
}`;

const RIPPLE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform sampler2D u_image;
uniform vec3 u_ripples[8]; // xy = origin (0..1), z = spawn time
uniform int  u_rippleCount;
out vec4 outColor;
void main() {
  vec2 uv = v_uv;
  for (int i = 0; i < 8; i++) {
    if (i >= u_rippleCount) break;
    vec3 r = u_ripples[i];
    float age = u_time - r.z;
    if (age < 0.0 || age > 1.5) continue;
    float radius = age * 0.7;
    float ring = exp(-30.0 * pow(distance(v_uv, r.xy) - radius, 2.0));
    vec2 dir = normalize(v_uv - r.xy + 1e-6);
    uv -= dir * ring * 0.04 * (1.0 - age / 1.5);
  }
  vec4 c = texture(u_image, uv);
  outColor = vec4(c.rgb * c.a, c.a);
}`;

const VORONOI_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform vec2 u_seeds[8];
uniform int  u_seedCount;
out vec4 outColor;
void main() {
  float bestD = 1e9;
  int bestI = 0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_seedCount) break;
    float d = distance(v_uv, u_seeds[i]);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  float h = float(bestI) / float(u_seedCount) + u_time * 0.05;
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.66) + h));
  // Edge highlight
  col *= 1.0 - smoothstep(0.0, 0.005, bestD - 0.0); // (no edge bias here; per-fragment 2nd-min would be expensive)
  outColor = vec4(col, 1.0);
}`;

// Module-scope registration — runs once per page load.
const PLASMA_PROGRAM:  ShaderProgramHandle = registerProgram('demo-plasma',  '', PLASMA_FRAG);
const RIPPLE_PROGRAM:  ShaderProgramHandle = registerProgram('demo-ripple',  '', RIPPLE_FRAG);
const VORONOI_PROGRAM: ShaderProgramHandle = registerProgram('demo-voronoi', '', VORONOI_FRAG);
const SHADERS = [PLASMA_PROGRAM, RIPPLE_PROGRAM, VORONOI_PROGRAM];

// --- Texture: load image once and register on first render -----------------

let cachedImageTexture: TextureHandle | null = null;
function useWeaselMarkTexture(): TextureHandle | null {
  const [tex, setTex] = useState<TextureHandle | null>(cachedImageTexture);
  useEffect(() => {
    if (cachedImageTexture) return;
    const img = new Image();
    img.src = weaselMarkUrl;
    img.onload = () => {
      cachedImageTexture = registerTexture(img);
      setTex(cachedImageTexture);
    };
  }, []);
  return tex;
}

// --- Component ------------------------------------------------------------

interface Ripple { x: number; y: number; t: number; }

export function CustomShaderDemo() {
  const [time, setTime] = useState(0);
  const [mouse, setMouse] = useState<[number, number]>([0.5, 0.5]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [seeds, setSeeds] = useState<{ x: number; y: number }[]>(() =>
    Array.from({ length: 6 }, (_, i) => ({
      x: 0.2 + 0.6 * (i / 5),
      y: 0.5 + 0.25 * Math.sin(i * 1.3),
    })));
  const tex = useWeaselMarkTexture();

  // Animation loop
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setTime((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Drop expired ripples
  useEffect(() => {
    setRipples((r) => r.filter((x) => time - x.t < 1.5).slice(-8));
  }, [time]);

  return (
    <div className="ckd-stack">
      <div style={{ display: 'flex', gap: 8 }}>
        <Panel
          title="Plasma"
          program={PLASMA_PROGRAM}
          uniforms={{ u_time: time, u_mouse: mouse }}
          onPointerMove={(x, y) => setMouse([x, y])}
          shaders={SHADERS}
        />
        <Panel
          title="Ripple"
          program={RIPPLE_PROGRAM}
          uniforms={{
            u_time: time,
            u_image: tex ?? PLASMA_PROGRAM as unknown as TextureHandle, // tex==null short-circuits below
            u_ripples: ripplesToFloat32(ripples),
            u_rippleCount: ripples.length,
          }}
          onPointerDown={(x, y) => setRipples((r) => [...r, { x, y, t: time }])}
          shaders={SHADERS}
          disabled={!tex}
        />
        <Panel
          title="Voronoi"
          program={VORONOI_PROGRAM}
          uniforms={{
            u_time: time,
            u_seeds: seedsToFloat32(seeds),
            u_seedCount: seeds.length,
          }}
          shaders={SHADERS}
          overlay={
            <SeedHandles seeds={seeds} setSeeds={setSeeds} width={PANEL_W} height={PANEL_H} />
          }
        />
      </div>
      <small style={{ color: '#888' }}>
        Custom shader API is <code>@experimental</code> — surface may shift before v1 stabilizes.
      </small>
    </div>
  );
}

function Panel({
  title, program, uniforms, onPointerMove, onPointerDown, overlay, shaders, disabled,
}: {
  title: string;
  program: ShaderProgramHandle;
  uniforms: Record<string, number | [number, number] | Float32Array>;
  onPointerMove?: (x: number, y: number) => void;
  onPointerDown?: (x: number, y: number) => void;
  overlay?: React.ReactNode;
  shaders: ShaderProgramHandle[];
  disabled?: boolean;
}) {
  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: `shader-${title.toLowerCase()}`,
    label: title,
    draw: (_d, view): DrawCommand[] => disabled ? [] : [{
      kind: 'group',
      transform: viewToMat3(view),
      children: [{
        kind: 'shader',
        program,
        bounds: { x: 0, y: 0, w: PANEL_W, h: PANEL_H },
        uniforms,
      }],
    }],
  }), [program, uniforms, disabled, title]);

  const scene = useScene<unknown>(() => ({ nodes: [] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <strong style={{ color: '#ddd', marginBottom: 4 }}>{title}</strong>
      <div
        style={{ position: 'relative', width: PANEL_W, height: PANEL_H }}
        onPointerMove={(e) => {
          if (!onPointerMove) return;
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onPointerMove((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
        onPointerDown={(e) => {
          if (!onPointerDown) return;
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onPointerDown((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
      >
        <SceneCanvas
          width={PANEL_W}
          height={PANEL_H}
          className="ckd-canvas"
          scene={scene}
          shaders={shaders}
          layers={{
            scene: { drawOne: () => [] },
            shader: { layer, after: 'scene' },
          }}
        />
        {overlay}
      </div>
    </div>
  );
}

function SeedHandles({
  seeds, setSeeds, width, height,
}: {
  seeds: { x: number; y: number }[];
  setSeeds: (s: { x: number; y: number }[] | ((p: { x: number; y: number }[]) => { x: number; y: number }[])) => void;
  width: number;
  height: number;
}) {
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {seeds.map((s, i) => (
        <circle
          key={i}
          cx={s.x * width}
          cy={s.y * height}
          r={6}
          fill="#fff"
          stroke="#222"
          strokeWidth={2}
          style={{ pointerEvents: 'auto', cursor: 'grab' }}
          onPointerDown={(e) => {
            e.preventDefault();
            const target = e.currentTarget;
            target.setPointerCapture(e.pointerId);
            const svg = target.ownerSVGElement!;
            const rect = svg.getBoundingClientRect();
            const move = (ev: PointerEvent) => {
              const x = (ev.clientX - rect.left) / rect.width;
              const y = (ev.clientY - rect.top) / rect.height;
              setSeeds((prev) => prev.map((p, j) => j === i ? { x: clamp01(x), y: clamp01(y) } : p));
            };
            const up = () => {
              target.removeEventListener('pointermove', move as EventListener);
              target.removeEventListener('pointerup', up);
            };
            target.addEventListener('pointermove', move as EventListener);
            target.addEventListener('pointerup', up);
          }}
        />
      ))}
    </svg>
  );
}

function ripplesToFloat32(ripples: Ripple[]): Float32Array {
  const out = new Float32Array(8 * 3);
  for (let i = 0; i < Math.min(8, ripples.length); i++) {
    out[i * 3 + 0] = ripples[i].x;
    out[i * 3 + 1] = ripples[i].y;
    out[i * 3 + 2] = ripples[i].t;
  }
  return out;
}
function seedsToFloat32(seeds: { x: number; y: number }[]): Float32Array {
  const out = new Float32Array(8 * 2);
  for (let i = 0; i < Math.min(8, seeds.length); i++) {
    out[i * 2 + 0] = seeds[i].x;
    out[i * 2 + 1] = seeds[i].y;
  }
  return out;
}
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
```

Notes:

- **Premultiplied alpha**: per `registerProgram` docs, the fragment shader MUST output premultiplied alpha (`outColor = vec4(rgb * a, a)`). The plasma and voronoi shaders output `a = 1` so this is moot; the ripple shader outputs `vec4(c.rgb * c.a, c.a)` which is the correct form.
- **Vertex shader**: passing `''` for the vert source uses the kit's default vertex shader, which exposes `v_uv`, `v_screen`, `v_world` varyings. The shaders here only use `v_uv`.
- **Uniform array shape**: `vec3 u_ripples[8]` → flat `Float32Array(24)` with stride 3. `vec2 u_seeds[8]` → flat `Float32Array(16)` with stride 2. `ShaderUniform`'s `Float32Array` branch maps to `uniform{Matrix}fv`; for vector arrays this requires the kit to detect array uniforms. If the kit does not currently flatten `Float32Array` to `vec2[]`/`vec3[]`, the demo may need to pass each slot as a separate `vec2`/`vec3`. Verify against the renderer's shader-uniform binding code (`drawShader` in `src/renderer/draw.ts`) before locking in the shape; if needed, change uniforms to `u_ripple0`, `u_ripple1`, etc.
- **Image loading**: `weaselMarkUrl` resolves through Vite's asset pipeline. The `useWeaselMarkTexture` hook loads + registers once across all instances of this component (cached in module scope).
- **`shaders` prop**: each `<SceneCanvas>` instance receives the `SHADERS` array so the renderer compiles all three programs even if a panel only uses one.

- [ ] **Step 5.5: Run the test, verify it passes**

```bash
pnpm vitest run demo/demos/__tests__/CustomShaderDemo.test.tsx
```

Expected: PASS (smoke only — jsdom has no WebGL2, but the component should mount).

- [ ] **Step 5.6: Add to demo registry**

```tsx
import { CustomShaderDemo } from './demos/CustomShaderDemo';
import CustomShaderDemoFull from './demos/CustomShaderDemo.tsx?raw';
```

```tsx
{
  id: 'custom-shader',
  title: 'Custom shaders',
  category: 'Paint & shading',
  description: 'Three custom GLSL shader panels: plasma (animated sin/cos field that follows the cursor), ripple (click anywhere to spawn an expanding ring on a sampled image), and voronoi (drag the white seed points to reshape the cellular pattern). Each panel registers its program at module scope via `registerProgram()` and emits a `ShaderDrawCommand` over a panel-bound rect; the renderer compiles them via the new `shaders` prop on SceneCanvas. Custom shader API is `@experimental`.',
  Component: CustomShaderDemo,
  full: CustomShaderDemoFull,
  path: 'demo/demos/CustomShaderDemo.tsx',
},
```

- [ ] **Step 5.7: Browser verify**

```bash
pnpm dev
```

Navigate to "Paint & shading → Custom shaders". Verify:
- All three panels render an animated shader effect
- Plasma's anchor follows the cursor
- Clicks in the Ripple panel produce expanding rings on the image
- Voronoi seed handles drag and the cells reshape

If a panel renders blank, check the browser console for shader compile errors and adjust the GLSL accordingly. If uniform-array binding doesn't work as written, switch to per-slot scalar uniforms (see notes in 5.4).

- [ ] **Step 5.8: Typecheck and commit**

```bash
pnpm tsc --noEmit
git add demo/demos/CustomShaderDemo.tsx demo/demos/__tests__/CustomShaderDemo.test.tsx demo/assets/ demo/registry.ts
git commit -m "feat(demo): custom shader triptych (plasma / ripple / voronoi)"
```

---

## Task 6: Final cross-demo verification

**Files:** none (verification only).

- [ ] **Step 6.1: Full typecheck**

```bash
pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 6.2: Full test suite**

```bash
pnpm vitest run
```

Expected: all green.

- [ ] **Step 6.3: Production-equivalent build (matches CI's release gate)**

```bash
pnpm tsc --noEmit && pnpm vitest run && pnpm tsup build
```

Expected: clean. Note from project memory: `prepublishOnly` runs all three; `vitest` alone does not typecheck production code.

- [ ] **Step 6.4: Demo build**

```bash
pnpm vite build
```

Expected: clean — confirms Vite asset/raw imports for the new files resolve at build time.

- [ ] **Step 6.5: Browser smoke pass**

```bash
pnpm dev
```

Open the demo app. Verify the new "Paint & shading" category appears in the sidebar with all four entries, each mounts cleanly, and switching between them does not throw console errors.

- [ ] **Step 6.6: Final commit if anything changed**

```bash
git status
```

If any uncommitted fixes from the cross-check, commit them with a clear message.

---

## Self-Review Notes

- **Spec coverage:** All four demos in the spec have a task. The `shaders` prop addition (Task 1) is an amendment to the spec's "no new kit API" non-goal; this plan acknowledges that explicitly.
- **`@experimental` shader API:** The plan calls this out in the demo description and in the GLSL implementation notes (premultiplied alpha + uniform-array verification step).
- **Uniform-array uncertainty:** Step 5.4 flags that the kit's handling of `Float32Array → vec2[]`/`vec3[]` uniform binding may need verification, with a fallback (per-slot uniforms). The implementer should verify against `drawShader` in `src/renderer/draw.ts` before assuming the array form works.
- **Tests are smoke-only for the demos:** jsdom doesn't support WebGL2, so the visual outcome can't be tested in unit tests. Each demo has a smoke test; visual verification is in the browser-verify step. This matches the existing `demo/demos/__tests__/` convention.
- **Image asset:** `demo/assets/weasel-mark.png` is created during Task 5; if the source PNG doesn't exist at task time, the implementer should substitute any small PNG.
- **Registry order:** New entries appear at the end of `DEMOS`. The `CATEGORIES` constant derives from `DEMOS`, so "Paint & shading" appears automatically as a new category.
