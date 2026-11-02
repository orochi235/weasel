import { useEffect, useMemo, useRef, useState } from 'react';
import { type ClockHandle, createClock, createClockRegistry } from '@weasel-js/clock';
import { useClockLoop } from '@weasel-js/clock/react';
import { SceneCanvas, asNodeId, effectivePose, ellipsePath, useLatest, useScene } from '@weasel-js/core';
import type { Action, Dims, Feature, ImmediateParams, RectPose, RenderLayer, Scene } from '@weasel-js/core';
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
  seeds,
  disabled,
}: {
  title: string;
  program: ShaderProgramHandle;
  clock: ClockHandle;
  /** Read at each paint, so a uniform that follows the clock costs no render. */
  uniforms: (seconds: number, size: Dims) => ShaderUniforms;
  onPointerMove?: (x: number, y: number) => void;
  onPress?: (x: number, y: number) => void;
  /** Handles drawn over the shader, which the `move` action drags. */
  seeds?: SeedScene;
  disabled?: boolean;
}) {
  const uniformsRef = useLatest(uniforms);
  const sizeRef = useRef<Dims>({ width: PANEL_W, height: PANEL_H });

  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: `shader-${title.toLowerCase()}`,
    label: title,
    subscribe: clock.onFrame,
    draw: (_data, _view, dims): DrawCommand[] => disabled ? [] : [{
      kind: 'shader',
      program,
      bounds: { x: 0, y: 0, w: dims.width, h: dims.height },
      uniforms: uniformsRef.current(secondsOf(clock), dims),
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
          const world = (params as ImmediateParams | undefined)?.world;
          if (world) onPointerMoveRef.current?.(world.x / sizeRef.current.width, world.y / sizeRef.current.height);
        },
      },
    };
    const press: Action = {
      id: 'shader.press',
      label: 'Press the shader panel',
      invoker: {
        timing: 'immediate',
        run: (_deps, params) => {
          const world = (params as ImmediateParams | undefined)?.world;
          if (world) onPressRef.current?.(world.x / sizeRef.current.width, world.y / sizeRef.current.height);
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

  const empty = useScene<never, 'default'>({ systemLayers: [{ id: 'default' }], initial: [] });
  const scene: SeedScene = seeds ?? empty;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <strong style={{ color: '#ddd', marginBottom: 4 }}>{title}</strong>
      <DemoStage width={PANEL_W} height={PANEL_H}>
        <SceneCanvas
          className="ckd-canvas"
          onResize={(s) => { sizeRef.current = s; }}
          scene={scene}
          shaders={SHADERS}
          features={seeds ? SEED_FEATURES : undefined}
          ambient={seeds ? undefined : ambient}
          layers={{
            shader: { layer, before: 'scene' },
            scene: { drawOne: (_n, p) => seeds ? drawSeed(p) : [] },
            selectionOverlay: null,
          }}
        />
      </DemoStage>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voronoi seeds: scene nodes over the shader, dragged by the `move` action
// ---------------------------------------------------------------------------

type SeedScene = Scene<unknown, 'default', RectPose>;
const SEED_R = 6;
const SEED_FEATURES: Feature[] = ['pick', 'move'];

const drawSeed = (p: RectPose): DrawCommand[] => [{
  kind: 'path',
  path: ellipsePath(p),
  fill: { paint: { color: '#fff' } },
  stroke: { paint: { color: '#222' }, width: 2 },
}];

/** Each seed's center as a fraction of the panel, where it is drawn: mid-drag included. */
function seedUniform(scene: SeedScene, size: Dims): number[] {
  return scene.renderOrder().flatMap((id) => {
    const node = scene.get(id);
    if (!node) return [];
    const p = effectivePose(scene, node);
    return [clamp01((p.x + SEED_R) / size.width), clamp01((p.y + SEED_R) / size.height)];
  });
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

const secondsOf = (clock: ClockHandle): number => clock.clock.elapsed / 1000;

export function CustomShaderDemo() {
  const frozen = useMemo(() => readFrozenTime(), []);
  // The shaders read the clock at paint; nothing here renders per frame.
  // `?frozenTime=N` holds it at N so a visual spec captures one known frame.
  const [clock] = useState(() => createClock({ rate: frozen === null ? 1 : 0, start: (frozen ?? 0) * 1000 }));
  const [registry] = useState(() => createClockRegistry());
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => registry.register('shaders', clock, () => root.current), [registry, clock]);
  useClockLoop(registry);
  const [mouse, setMouse] = useState<[number, number]>([0.5, 0.5]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const seeds = useScene<unknown, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: Array.from({ length: 6 }, (_, i) => ({
      id: asNodeId(`seed-${i}`),
      kind: 'mark' as const,
      layer: 'default' as const,
      pose: {
        x: (0.2 + 0.6 * (i / 5)) * PANEL_W - SEED_R,
        y: (0.5 + 0.25 * Math.sin(i * 1.3)) * PANEL_H - SEED_R,
        width: 2 * SEED_R,
        height: 2 * SEED_R,
      },
      data: null,
    })),
    subscribe: false,
  });
  const tex = useWeaselMarkTexture();

  return (
    <div className="ckd-stack" ref={root}>
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
            const t = secondsOf(clock);
            setRipples((r) => [...liveRipples(r, t), { x, y, t }].slice(-8));
          }}
          disabled={!tex}
        />
        <Panel
          title="Voronoi"
          program={VORONOI_PROGRAM}
          clock={clock}
          uniforms={(time, size) => ({
            u_time: time,
            u_seeds: seedUniform(seeds, size),
            u_seedCount: seeds.renderOrder().length,
          })}
          seeds={seeds}
        />
      </div>
    </div>
  );
}
