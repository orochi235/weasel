import { type GlMat3, PATH_L, PATH_M, PATH_Z, type Path } from '@weasel-js/geom';
import type { CommandPaint, GradStop } from '@weasel-js/paint';
import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { latin1 } from './testing/latin1';
import { NO_FONTS } from './testing/noFonts';
import { writePdf } from './writePdf';

const rect: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 20 };
const redBlue: GradStop[] = [
  { offset: 0, color: '#ff0000' },
  { offset: 1, color: '#0000ff' },
];

async function render(commands: DrawCommand[], view?: GlMat3) {
  const { bytes, skipped } = await writePdf([{ width: 100, height: 100, commands, view }], {
    fonts: NO_FONTS,
    compress: false,
  });
  const s = latin1(bytes);
  // The page's content stream is allocated before any shading, so it is the first stream.
  const content = s.slice(s.indexOf('stream\n') + 7, s.indexOf('\nendstream'));
  return { s, content, skipped };
}

const filled = (paint: CommandPaint, path: Path = rect): DrawCommand => ({ kind: 'path', path, fill: { paint } });

/** The bytes of the first type 4 shading stream in `s`. */
function meshData(s: string): Uint8Array {
  const at = s.indexOf('/ShadingType 4');
  const start = s.indexOf('stream\n', at) + 7;
  const end = s.indexOf('\nendstream', start);
  const out = new Uint8Array(new ArrayBuffer(end - start));
  for (let i = 0; i < out.length; i++) out[i] = s.charCodeAt(start + i);
  return out;
}

function meshVertex(s: string, data: Uint8Array, i: number): { x: number; y: number; t: number } {
  const decode = /\/ShadingType 4[^]*?\/Decode \[([^\]]*)\]/.exec(s)?.[1].split(' ').map(Number) ?? [];
  const [x0, x1, y0, y1] = decode as [number, number, number, number];
  const v = new DataView(data.buffer, data.byteOffset + i * 11, 11);
  const max = 2 ** 32 - 1;
  return {
    x: x0 + (v.getUint32(1) / max) * (x1 - x0),
    y: y0 + (v.getUint32(5) / max) * (y1 - y0),
    t: v.getUint16(9) / 65535,
  };
}

describe('paintShading', () => {
  it('writes a linear gradient as an axial shading over its from/to', async () => {
    const { s, content, skipped } = await render([
      filled({ kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, stops: redBlue, units: 'local' }),
    ]);
    expect(skipped).toEqual([]);
    expect(s).toContain('/ShadingType 2');
    expect(s).toContain('/ColorSpace /DeviceRGB');
    expect(s).toContain('/Coords [0 0 10 0]');
    expect(s).toContain('/Extend [true true]');
    expect(s).toContain('/FunctionType 2 /Domain [0 1] /C0 [1 0 0] /C1 [0 0 1] /N 1');
    expect(s).toMatch(/\/Shading <<\/Sh1 \d+ 0 R>>/);
    expect(content).toContain('q\n0 0 10 20 re\nW\nn\n/Sh1 sh\nQ\n');
    expect(s).not.toContain('/SMask');
  });

  it('clips an even-odd path with W*', async () => {
    const { content } = await render([
      filled(
        { kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, stops: redBlue, units: 'local' },
        {
          kind: 'polygon',
          commands: Uint8Array.from([PATH_M, PATH_L, PATH_L, PATH_Z]),
          coords: Float32Array.from([0, 0, 10, 0, 10, 10]),
          fillRule: 'evenodd',
        },
      ),
    ]);
    expect(content).toContain('W*\nn\n/Sh1 sh\n');
  });

  it('writes a radial gradient as a type 3 shading from the center', async () => {
    const { s } = await render([
      filled({ kind: 'radial-gradient', center: { x: 5, y: 5 }, radius: 4, stops: redBlue, units: 'local' }),
    ]);
    expect(s).toContain('/ShadingType 3');
    expect(s).toContain('/Coords [5 5 0 5 5 4]');
    expect(s).toContain('/Extend [true true]');
  });

  it('writes a conic gradient as a free-form triangle mesh', async () => {
    const { s } = await render([
      filled({ kind: 'conic-gradient', center: { x: 5, y: 10 }, angle: Math.PI / 2, stops: redBlue, units: 'local' }),
    ]);
    expect(s).toContain('/ShadingType 4');
    expect(s).toContain('/BitsPerCoordinate 32 /BitsPerComponent 16 /BitsPerFlag 8');
    const data = meshData(s);
    expect(data.length).toBe(360 * 3 * 11);
    const center = meshVertex(s, data, 0);
    const first = meshVertex(s, data, 1);
    const last = meshVertex(s, data, 360 * 3 - 1);
    expect(center.x).toBeCloseTo(5, 3);
    expect(center.y).toBeCloseTo(10, 3);
    expect(center.t).toBeCloseTo(0.5 / 360, 4);
    // The wedges start at `angle`: straight down in a y-down frame.
    expect(first.x).toBeCloseTo(5, 3);
    expect(first.y).toBeGreaterThan(10 + Math.hypot(5, 10));
    expect(first.t).toBe(0);
    expect(last.x).toBeCloseTo(first.x, 3);
    expect(last.y).toBeCloseTo(first.y, 3);
    expect(last.t).toBe(1);
  });

  it('stitches multi-stop gradients from type 2 functions', async () => {
    const { s } = await render([
      filled({
        kind: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
        units: 'local',
        stops: [
          { offset: 0.2, color: '#ff0000' },
          { offset: 0.5, color: '#00ff00' },
          { offset: 0.8, color: '#0000ff' },
        ],
      }),
    ]);
    expect(s).toContain('/FunctionType 3');
    expect(s).toContain('/Bounds [0.2 0.5 0.8]');
    expect(s).toContain('/Encode [0 1 0 1 0 1 0 1]');
    // Flat extension before the first stop and after the last.
    expect(s).toContain('/C0 [1 0 0] /C1 [1 0 0]');
    expect(s).toContain('/C0 [0 0 1] /C1 [0 0 1]');
  });

  it('samples a non-rgb interpolation into enough stops to follow it', async () => {
    const { s } = await render([
      filled({
        kind: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
        units: 'local',
        interpolate: 'oklch',
        stops: redBlue,
      }),
    ]);
    const bounds = /\/Bounds \[([^\]]*)\]/.exec(s)?.[1].split(' ') ?? [];
    expect(bounds).toHaveLength(62);
    expect(s.match(/\/FunctionType 2/g)).toHaveLength(63);
  });

  it('masks a gradient whose stops are not all opaque', async () => {
    const { s, content } = await render([
      filled({
        kind: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
        units: 'local',
        stops: [
          { offset: 0, color: 'rgba(255, 0, 0, 0)' },
          { offset: 1, color: '#0000ff' },
        ],
      }),
    ]);
    expect(s).toMatch(/\/SMask <<\/Type \/Mask \/S \/Luminosity \/G \d+ 0 R>>/);
    expect(s).toContain('/Group <</Type /Group /S /Transparency /CS /DeviceGray>>');
    expect(s).toContain('/ColorSpace /DeviceGray');
    expect(s).toContain('/C0 [0] /C1 [1]');
    expect(content).toMatch(/W\nn\n\/GS\d+ gs\n\/Sh1 sh\n/);
  });

  it('folds a uniform stop alpha into ca instead of a mask', async () => {
    const { s } = await render([
      filled({
        kind: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
        units: 'local',
        opacity: 0.5,
        stops: [
          { offset: 0, color: 'rgba(255, 0, 0, 0.5)' },
          { offset: 1, color: 'rgba(0, 0, 255, 0.5)' },
        ],
      }),
    ]);
    expect(s).not.toContain('/SMask');
    expect(s).toContain('/ca 0.25');
  });

  it('places screen-unit paint in page space and world-unit paint through the view', async () => {
    const t = Float64Array.from([2, 0, 0, 0, 2, 0, 10, 20, 1]);
    const grad = (units: 'screen' | 'world' | 'local'): CommandPaint => ({
      kind: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 0 },
      stops: redBlue,
      units,
    });
    const group = (units: 'screen' | 'world' | 'local'): DrawCommand[] => [
      { kind: 'group', transform: t, children: [filled(grad(units))] },
    ];
    const inverse = '0.5 0 0 0.5 -5 -10 cm\n/Sh1 sh';

    expect((await render(group('screen'))).content).toContain(`W\nn\n${inverse}`);
    expect((await render(group('local'))).content).toContain('W\nn\n/Sh1 sh');
    // No view: world falls back to screen.
    expect((await render(group('world'))).content).toContain(`W\nn\n${inverse}`);
    // The view is the group's own transform, so world space is the group's frame.
    expect((await render(group('world'), t)).content).toContain('W\nn\n/Sh1 sh');
    const view = Float64Array.from([3, 0, 0, 0, 3, 0, 0, 0, 1]);
    expect((await render(group('world'), view)).content).toContain('W\nn\n1.5 0 0 1.5 -5 -10 cm\n/Sh1 sh');
  });
});
