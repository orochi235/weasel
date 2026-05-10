import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, useHandleDrag, useScene } from '@orochi235/weasel';
import type { RenderLayer } from '@orochi235/weasel';
import {
  registerProgram, registerTexture, viewToMat3,
  type DrawCommand, type ShaderProgramHandle, type TextureHandle,
} from '@orochi235/weasel-gl';
import weaselMarkUrl from '../assets/weasel-mark.png';

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

// ---------------------------------------------------------------------------
// Uniform helpers (per-slot, not Float32Array)
// ---------------------------------------------------------------------------

interface Ripple { x: number; y: number; t: number; }

function rippleUniforms(ripples: Ripple[]): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  for (let i = 0; i < 8; i++) {
    const r = ripples[i];
    out[`u_ripples[${i}]`] = r ? [r.x, r.y, r.t] : [0, 0, -1];
  }
  return out;
}

function seedUniforms(seeds: { x: number; y: number }[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (let i = 0; i < 8; i++) {
    const s = seeds[i] ?? { x: -1, y: -1 };
    out[`u_seeds[${i}]`] = [s.x, s.y];
  }
  return out;
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

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

type ShaderUniforms = Record<string, number | [number, number] | [number, number, number] | [number, number, number, number] | TextureHandle>;

function Panel({
  title,
  program,
  uniforms,
  onPointerMove,
  onPointerDown,
  overlay,
  disabled,
}: {
  title: string;
  program: ShaderProgramHandle;
  uniforms: ShaderUniforms;
  onPointerMove?: (x: number, y: number) => void;
  onPointerDown?: (x: number, y: number) => void;
  overlay?: React.ReactNode;
  disabled?: boolean;
}) {
  const uniformsRef = useRef(uniforms);
  uniformsRef.current = uniforms;

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
        uniforms: uniformsRef.current,
      }],
    }],
  }), [program, disabled, title]);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

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
          shaders={SHADERS}
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

export function CustomShaderDemo() {
  const [time, setTime] = useState(0);
  const [mouse, setMouse] = useState<[number, number]>([0.5, 0.5]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [mutableSeeds, setMutableSeeds] = useState<{ x: number; y: number }[]>(() =>
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

  const plasmaUniforms: ShaderUniforms = useMemo(() => ({
    u_time: time,
    u_mouse: mouse,
  }), [time, mouse]);

  const rippleUniforms_ = useMemo((): ShaderUniforms => ({
    u_time: time,
    ...(tex ? { u_image: tex } : {}),
    ...rippleUniforms(ripples),
    u_rippleCount: ripples.length,
  }), [time, tex, ripples]);

  const voronoiUniforms = useMemo((): ShaderUniforms => ({
    u_time: time,
    ...seedUniforms(mutableSeeds),
    u_seedCount: mutableSeeds.length,
  }), [time, mutableSeeds]);

  return (
    <div className="ckd-stack">
      <div style={{ display: 'flex', gap: 8 }}>
        <Panel
          title="Plasma"
          program={PLASMA_PROGRAM}
          uniforms={plasmaUniforms}
          onPointerMove={(x, y) => setMouse([x, y])}
        />
        <Panel
          title="Ripple"
          program={RIPPLE_PROGRAM}
          uniforms={rippleUniforms_}
          onPointerDown={(x, y) => setRipples((r) => [...r, { x, y, t: time }])}
          disabled={!tex}
        />
        <Panel
          title="Voronoi"
          program={VORONOI_PROGRAM}
          uniforms={voronoiUniforms}
          overlay={
            <SeedHandles seeds={mutableSeeds} setSeeds={setMutableSeeds} width={PANEL_W} height={PANEL_H} />
          }
        />
      </div>
      <small style={{ color: '#888' }}>
        Custom shader API is <code>@experimental</code> — surface may shift before v1 stabilizes.
      </small>
    </div>
  );
}
