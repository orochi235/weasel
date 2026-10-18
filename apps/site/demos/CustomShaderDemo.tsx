import { useEffect, useMemo, useState } from 'react';
import { SceneCanvas, useFrameClock, useHandleDrag, useLatest, useScene } from '@weasel-js/core';
import type { Action, Dims, FrameClock, RenderLayer } from '@weasel-js/core';
import {
  registerProgram, registerTexture,
  type DrawCommand, type ShaderProgramHandle, type ShaderUniform, type TextureHandle,
} from '@weasel-js/renderer';
import weaselMarkUrl from '../assets/weasel-mark.png';
import { DemoStage } from './DemoStage';

const PANEL_W = 240;
const PANEL_H = 240;

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const PLASMA_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform vec2  u_mouse;
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

const RIPPLE_SECONDS = 1.5;
const RIPPLE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform sampler2D u_image;
uniform vec3 u_ripples[8];
uniform float u_rippleCount;
out vec4 outColor;
void main() {
  vec2 uv = v_uv;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_rippleCount) break;
    vec3 r = u_ripples[i];
    float age = u_time - r.z;
    if (age < 0.0 || age > ${RIPPLE_SECONDS.toFixed(1)}) continue;
    float radius = age * 0.7;
    float ring = exp(-30.0 * pow(distance(v_uv, r.xy) - radius, 2.0));
    vec2 dir = normalize(v_uv - r.xy + 1e-6);
    uv -= dir * ring * 0.04 * (1.0 - age / ${RIPPLE_SECONDS.toFixed(1)});
  }
  // A registered texture is premultiplied already, which is what outColor takes.
  outColor = texture(u_image, uv);
}`;

const VORONOI_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform vec2 u_seeds[8];
uniform float u_seedCount;
out vec4 outColor;
void main() {
  float bestD = 1e9;
  int bestI = 0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_seedCount) break;
    float d = distance(v_uv, u_seeds[i]);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  float h = float(bestI) / max(1.0, u_seedCount) + u_time * 0.05;
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.66) + h));
  outColor = vec4(col, 1.0);
}`;

// Module-scope registration — runs once per page load.
const PLASMA_PROGRAM:  ShaderProgramHandle = registerProgram('demo-plasma',  '', PLASMA_FRAG);
const RIPPLE_PROGRAM:  ShaderProgramHandle = registerProgram('demo-ripple',  '', RIPPLE_FRAG);
const VORONOI_PROGRAM: ShaderProgramHandle = registerProgram('demo-voronoi', '', VORONOI_FRAG);
const SHADERS = [PLASMA_PROGRAM, RIPPLE_PROGRAM, VORONOI_PROGRAM];

interface Ripple { x: number; y: number; t: number; }

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

/** The ripples still spreading at `time`, newest last; the shader takes eight. */
function liveRipples(ripples: Ripple[], time: number): Ripple[] {
  return ripples.filter((r) => time - r.t < RIPPLE_SECONDS).slice(-8);
}

// ---------------------------------------------------------------------------
// Texture: load once, cache at module scope
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

type ShaderUniforms = Record<string, ShaderUniform>;

function Panel({
  title,
  program,
  clock,
  uniforms,
  onPointerMove,
  onPress,
  overlay,
  disabled,
}: {
  title: string;
  program: ShaderProgramHandle;
  clock: FrameClock;
  /** Read at each paint, so a uniform that follows the clock costs no render. */
  uniforms: (seconds: number) => ShaderUniforms;
  onPointerMove?: (x: number, y: number) => void;
  onPress?: (x: number, y: number) => void;
  /** Drawn over the canvas, at the size it paints. */
  overlay?: (size: Dims) => React.ReactNode;
  disabled?: boolean;
}) {
  const uniformsRef = useLatest(uniforms);
  const [size, setSize] = useState<Dims>({ width: PANEL_W, height: PANEL_H });
  const sizeRef = useLatest(size);

  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: `shader-${title.toLowerCase()}`,
    label: title,
    subscribe: clock.subscribe,
    draw: (_data, _view, dims): DrawCommand[] => disabled ? [] : [{
      kind: 'shader',
      program,
      bounds: { x: 0, y: 0, w: dims.width, h: dims.height },
      uniforms: uniformsRef.current(clock.seconds()),
    }],
  }), [program, disabled, title, uniformsRef, clock]);

  // Press and hover route through ambient bindings: a bare canvas has no
  // active tool ahead of it to claim either.
  const onPressRef = useLatest(onPress);
  const onPointerMoveRef = useLatest(onPointerMove);
  const ambient = useMemo(() => {
    const follow: Action = {
      id: 'shader.follow',
      label: 'Follow the pointer over the shader panel',
      invoker: {
        timing: 'immediate',
        run: (_deps, params) => {
          const p = params as { worldX: number; worldY: number };
          onPointerMoveRef.current?.(p.worldX / sizeRef.current.width, p.worldY / sizeRef.current.height);
        },
      },
    };
    const press: Action = {
      id: 'shader.press',
      label: 'Press the shader panel',
      invoker: {
        timing: 'immediate',
        run: (_deps, params) => {
          const p = params as { worldX: number; worldY: number };
          onPressRef.current?.(p.worldX / sizeRef.current.width, p.worldY / sizeRef.current.height);
        },
      },
    };
    return [{
      id: 'press',
      eligibility: {},
      actions: [press, follow],
      bindings: [
        { spec: { kind: 'pointerDown' as const }, actionId: press.id },
        { spec: { kind: 'hover' as const }, actionId: follow.id },
      ],
    }];
  }, [onPressRef, onPointerMoveRef, sizeRef]);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <strong style={{ color: '#ddd', marginBottom: 4 }}>{title}</strong>
      <div style={{ position: 'relative' }}>
        <DemoStage width={PANEL_W} height={PANEL_H}>
          <SceneCanvas
            className="ckd-canvas"
            onResize={setSize}
            scene={scene}
            shaders={SHADERS}
            ambient={ambient}
            layers={{
              scene: { drawOne: () => [] },
              shader: { layer, after: 'scene' },
            }}
          />
        </DemoStage>
        {overlay?.(size)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voronoi seed drag handles (SVG overlay)
// ---------------------------------------------------------------------------

function SeedHandles({
  seeds,
  setSeeds,
  width,
  height,
}: {
  seeds: { x: number; y: number }[];
  setSeeds: (s: { x: number; y: number }[] | ((p: { x: number; y: number }[]) => { x: number; y: number }[])) => void;
  width: number;
  height: number;
}) {
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {seeds.map((s, i) => (
        <SeedHandle key={i} seed={s} index={i} width={width} height={height} setSeeds={setSeeds} />
      ))}
    </svg>
  );
}

function SeedHandle({
  seed, index, width, height, setSeeds,
}: {
  seed: { x: number; y: number };
  index: number;
  width: number;
  height: number;
  setSeeds: (s: { x: number; y: number }[] | ((p: { x: number; y: number }[]) => { x: number; y: number }[])) => void;
}) {
  const drag = useHandleDrag<SVGCircleElement>({
    onMove: ({ x, y }) => {
      setSeeds((prev) => prev.map((p, j) => j === index ? { x: clamp01(x / width), y: clamp01(y / height) } : p));
    },
  });
  return (
    <circle
      cx={seed.x * width}
      cy={seed.y * height}
      r={6}
      fill="#fff"
      stroke="#222"
      strokeWidth={2}
      style={{ pointerEvents: 'auto', cursor: 'grab' }}
      {...drag}
    />
  );
}

// ---------------------------------------------------------------------------
// Main demo
// ---------------------------------------------------------------------------

/** Read `?frozenTime=N` from the URL once at mount; if present, return that
 *  fixed seconds-since-start instead of a live RAF loop. Used by the visual-
 *  regression spec to pin every panel to a deterministic frame. */
function readFrozenTime(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('frozenTime');
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function CustomShaderDemo() {
  const frozen = useMemo(() => readFrozenTime(), []);
  // The shaders read the clock at paint; nothing here renders per frame.
  // `?frozenTime=N` holds it at N so a visual spec captures one known frame.
  const clock = useFrameClock({ paused: frozen !== null, start: frozen ?? 0 });
  const [mouse, setMouse] = useState<[number, number]>([0.5, 0.5]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [mutableSeeds, setMutableSeeds] = useState<{ x: number; y: number }[]>(() =>
    Array.from({ length: 6 }, (_, i) => ({
      x: 0.2 + 0.6 * (i / 5),
      y: 0.5 + 0.25 * Math.sin(i * 1.3),
    })));
  const tex = useWeaselMarkTexture();

  return (
    <div className="ckd-stack">
      <div style={{ display: 'flex', gap: 8 }}>
        <Panel
          title="Plasma"
          program={PLASMA_PROGRAM}
          clock={clock}
          uniforms={(time) => ({ u_time: time, u_mouse: mouse })}
          onPointerMove={(x, y) => setMouse([x, y])}
        />
        <Panel
          title="Ripple"
          program={RIPPLE_PROGRAM}
          clock={clock}
          uniforms={(time) => {
            const live = liveRipples(ripples, time);
            return {
              u_time: time,
              ...(tex ? { u_image: tex } : {}),
              u_ripples: live.flatMap((r) => [r.x, r.y, r.t]),
              u_rippleCount: live.length,
            };
          }}
          onPress={(x, y) => {
            const t = clock.seconds();
            setRipples((r) => [...liveRipples(r, t), { x, y, t }].slice(-8));
          }}
          disabled={!tex}
        />
        <Panel
          title="Voronoi"
          program={VORONOI_PROGRAM}
          clock={clock}
          uniforms={(time) => ({
            u_time: time,
            u_seeds: mutableSeeds.flatMap((s) => [s.x, s.y]),
            u_seedCount: mutableSeeds.length,
          })}
          overlay={(size) => (
            <SeedHandles seeds={mutableSeeds} setSeeds={setMutableSeeds} width={size.width} height={size.height} />
          )}
        />
      </div>
    </div>
  );
}
