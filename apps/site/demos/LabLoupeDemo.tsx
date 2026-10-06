import { useVisibleRaf } from '@weasel-js/core';
import { defineInstrument, f, Lab, type ViewTransform } from '@weasel-js/labkit';
import { type CanvasSource, createCanvasSource, TrialLoupe } from '@weasel-js/labkit/loupe';
import { useEffect, useRef, useState } from 'react';
// In-repo, so the source stylesheet: a consumer imports the built
// `@weasel-js/labkit/styles.css` instead.
import '@weasel-js/labkit/styles.less';
import 'windease/styles.css';

const RAMP = ['#e5484d', '#f5a524', '#46a758', '#0091ff', '#8e4ec6'];

/** Fine enough that the difference between magnifying and not is obvious: a
 *  1px grid, a run of single-pixel rules, and a ramp of swatches. */
function drawDetail(ctx: CanvasRenderingContext2D, zoom: number): void {
  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(0, 0, 800, 600);

  ctx.strokeStyle = '#c9ccd4';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let x = 0; x <= 800; x += 20) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 600);
  }
  for (let y = 0; y <= 600; y += 20) {
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
  }
  ctx.stroke();

  // Alternating one-world-pixel rules: illegible at 1:1, and the sharpest test
  // of what a lens does to a hard edge.
  ctx.fillStyle = '#1f2430';
  for (let i = 0; i < 40; i++) ctx.fillRect(80 + i * 2, 90, 1, 70);

  RAMP.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(80 + i * 36, 200, 30, 30);
  });

  ctx.fillStyle = '#1f2430';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('eleven pixel type, legible only under the lens', 80, 280);
}

const drawn = defineInstrument({
  name: 'Drawn detail',
  config: f.schema({
    mode: f
      .enum('vector', ['vector', 'pixel'])
      .label('Lens')
      .describe('vector re-draws the layers magnified; pixel enlarges what was presented'),
  }),
  initialState: () => ({}),
  // Inside the canvas stack, so the lens re-draws the stack's own layers.
  render: ({ config }) => <TrialLoupe mode={config.mode} />,
  canvas: {
    initialView: { zoom: 1, pan: { x: 24, y: 24 } },
    layers: [{ id: 'detail', draw: (ctx, { zoom }) => drawDetail(ctx, zoom) }],
  },
  layers: { ids: [{ id: 'detail', label: 'Detail' }] },
});

interface CardProps {
  view: ViewTransform;
  lines: number;
}

/** The whole DOM instrument, and the whole of what its lens draws. Rendering
 *  the same component through the camera the lens hands over is the DOM
 *  painter's entire contract. */
function Card({ view, lines }: CardProps) {
  const style = {
    transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
  };
  return (
    <div className="lab-loupe-stage" style={style}>
      {Array.from({ length: lines }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length ruler, no identity
        <p key={i} className="lab-loupe-line">
          <span className="lab-loupe-num">{String(i).padStart(3, '0')}</span>
          the quick brown fox jumps over the lazy dog — 0123456789
        </p>
      ))}
    </div>
  );
}

const IDENTITY: ViewTransform = { zoom: 1, pan: { x: 0, y: 0 } };

const written = defineInstrument({
  name: 'Written detail',
  config: f.schema({ lines: f.number(20).range(4, 60).slider().label('Lines') }),
  initialState: () => ({}),
  render: ({ config }) => (
    <TrialLoupe diameter={220} render={({ view }) => <Card view={view} lines={config.lines} />}>
      <Card view={IDENTITY} lines={config.lines} />
    </TrialLoupe>
  ),
});

const VERT = 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';

// Rings a device pixel and a half wide crossed with spokes: a moire at 1:1,
// countable under the lens.
const FRAG = `precision mediump float;
uniform vec2 u_size;
uniform float u_time;
void main() {
  vec2 p = gl_FragCoord.xy - u_size * 0.5;
  float rings = step(0.5, fract(length(p) / 3.0 - u_time));
  float spokes = step(0.5, fract(atan(p.y, p.x) * 48.0 / 6.2831853));
  vec3 c = mix(vec3(0.90, 0.28, 0.30), vec3(0.00, 0.57, 1.00), abs(rings - spokes));
  gl_FragColor = vec4(c, 1.0);
}`;

function compile(gl: WebGLRenderingContext): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return program;
}

/**
 * A WebGL view labkit knows nothing about: it creates its own context, without
 * `preserveDrawingBuffer`, and draws from its own loop. The only thing it does
 * for the lens is call `source.capture()` after each frame.
 */
function ForeignGl() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [source, setSource] = useState<CanvasSource | null>(null);
  const gl = useRef<{ ctx: WebGLRenderingContext; program: WebGLProgram } | null>(null);
  const clock = useRef({ last: null as number | null, t: 0 });

  const loop = useVisibleRaf(
    (now) => {
      loop.request();
      const g = gl.current;
      const canvas = canvasRef.current;
      if (!g || !canvas || !source) return;
      const c = clock.current;
      if (c.last !== null) c.t += (now - c.last) / 1000;
      c.last = now;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const { ctx, program } = g;
      ctx.viewport(0, 0, w, h);
      ctx.uniform2f(ctx.getUniformLocation(program, 'u_size'), w, h);
      ctx.uniform1f(ctx.getUniformLocation(program, 'u_time'), c.t * 0.5);
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
      source.capture();
    },
    {
      target: canvasRef,
      onResume: () => {
        clock.current.last = null;
      },
    },
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('webgl', { antialias: false });
    if (!ctx) return;
    const program = compile(ctx);
    ctx.useProgram(program);
    ctx.bindBuffer(ctx.ARRAY_BUFFER, ctx.createBuffer());
    // One triangle covering the whole clip space.
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(program, 'a_pos');
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    gl.current = { ctx, program };
    setSource(createCanvasSource(ctx));
  }, []);

  useEffect(() => {
    loop.request();
    return () => loop.cancel();
  }, [loop]);

  return (
    <TrialLoupe source={source ?? undefined} factor={8}>
      <canvas ref={canvasRef} className="lab-loupe-gl" />
    </TrialLoupe>
  );
}

const foreign = defineInstrument({
  name: 'Foreign WebGL',
  config: f.schema({}),
  initialState: () => ({}),
  render: () => <ForeignGl />,
});

export function LabLoupeDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab
        title="Loupe"
        instruments={[drawn, written, foreign]}
        defaultInstrument="Drawn detail"
      />
    </div>
  );
}
