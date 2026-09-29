import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FillStyle } from '@weasel-js/paint';
import type { ResolvedRun } from '@weasel-js/text';
import { FIXTURE_FONT, registerFont } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetPaintKindsForTests, getPaintKind, registerPaintKindLoader } from '../core/paintKinds';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { RectPose } from 'features/groups/composePose';
import type { DrawCommand } from '../renderer/DrawCommand';
import { warmRender } from './renderSceneToPixels';
import { renderNeeds } from './renderNeeds';

beforeEach(() => {
  _resetPaintKindsForTests();
  _resetFontRegistryForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  _resetPaintKindsForTests();
  _resetFontRegistryForTests();
});

function run(fontFamily: string, fontWeight = 400, fontStyle: 'normal' | 'italic' = 'normal', fill?: FillStyle): ResolvedRun {
  return {
    text: 'Hi', fontFamily, fontSize: 12, fontWeight, fontStyle,
    fill: fill ?? { fill: 'solid', color: '#000' },
  } as ResolvedRun;
}

const mesh = { fill: 'mesh-gradient', patches: [] } as unknown as FillStyle;

/** Text in two families, and a mesh fill two groups down. */
const COMMANDS: DrawCommand[] = [
  { kind: 'text', x: 0, y: 0, style: {} as never, runs: [run('serif'), run('mono', 700, 'italic')] },
  {
    kind: 'group',
    children: [{
      kind: 'group',
      children: [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 4, height: 4 }, fill: mesh }],
    }],
  },
];

/** Every fetch is served; `/broken.*` fails. */
function stubFetch(): ReturnType<typeof vi.fn> {
  const fetch = vi.fn(async (url: string) => {
    if (url.startsWith('/broken')) throw new Error('offline');
    return url.endsWith('.json')
      ? { ok: true, json: async () => FIXTURE_FONT }
      : { ok: true, blob: async () => new Blob(['PNG'], { type: 'image/png' }) };
  });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 512, height: 512, close() {} })));
  return fetch;
}

/** A container holding a node that draws `COMMANDS`, so the fonts and kinds
 *  arrive through the scene walk's nesting. */
function sceneArgs() {
  const pose = { x: 0, y: 0, width: 10, height: 10 };
  const scene = createScene<null, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: asNodeId('box'), kind: 'container', layer: 'main', pose, data: null },
      { id: asNodeId('art'), kind: 'leaf', layer: 'main', pose, data: null, parent: asNodeId('box') },
    ],
  });
  return {
    scene,
    sourceRect: pose,
    scale: { x: 1, y: 1 },
    drawOne: (node: { id: string }) => (node.id === 'art' ? COMMANDS : []),
  };
}

describe('renderNeeds', () => {
  it('lists each face text is set in, and each paint kind, through nested groups', () => {
    expect(renderNeeds(COMMANDS)).toEqual({
      fonts: [
        { family: 'serif', weight: 400, style: 'normal' },
        { family: 'mono', weight: 700, style: 'italic' },
      ],
      paintKinds: ['solid', 'mesh-gradient'],
    });
  });

  it('reads the paint of a stroke and of a text run', () => {
    const needs = renderNeeds([
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, stroke: { paint: mesh } },
      { kind: 'text', x: 0, y: 0, style: {} as never, runs: [run('serif', 400, 'normal', { fill: 'late' } as never)] },
    ]);
    expect(needs.paintKinds).toEqual(['mesh-gradient', 'late']);
  });
});

describe('warmRender', () => {
  it('loads a paint kind declared lazily', async () => {
    const load = vi.fn(async () => ({ ...getPaintKind('solid')!, id: 'test-late', label: 'Late' }));
    registerPaintKindLoader('test-late', load);
    await warmRender();
    expect(load).toHaveBeenCalledTimes(1);
    expect(getPaintKind('test-late')?.label).toBe('Late');
  });

  it('starts a font registered lazily and waits for it to settle', async () => {
    let land!: () => void;
    const fetched = new Promise<void>((r) => { land = r; });
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await fetched;
      throw new Error('offline');
    });
    void registerFont('late', {}, '/l.json', '/l.png', { lazy: true }).catch(() => {});
    let settled = false;
    const warm = warmRender().catch(() => {}).finally(() => { settled = true; });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    expect(settled).toBe(false);
    land();
    await warm;
    expect(settled).toBe(true);
  });

  it('rejects for a family nothing registered', async () => {
    await expect(warmRender({ families: ['nope'] })).rejects.toThrow(/nope/);
  });

  describe('scoped to a render', () => {
    it('loads the faces and kinds the render draws, and nothing else', async () => {
      const fetch = stubFetch();
      void registerFont('serif', {}, '/serif.json', '/serif.png', { lazy: true });
      void registerFont('mono', { weight: 700, style: 'italic' }, '/mono.json', '/mono.png', { lazy: true });
      registerFont('broken', {}, '/broken.json', '/broken.png', { lazy: true }).catch(() => {});
      const unused = vi.fn(async () => ({ ...getPaintKind('solid')!, id: 'test-unused' }));
      registerPaintKindLoader('test-unused', unused);

      await warmRender({ render: sceneArgs() });

      expect(fetch.mock.calls.map(([url]) => url).sort())
        .toEqual(['/mono.json', '/mono.png', '/serif.json', '/serif.png']);
      expect(getPaintKind('mesh-gradient')).toBeDefined();
      expect(unused).not.toHaveBeenCalled();
    });

    it('rejects when a face the render sets text in fails to load', async () => {
      stubFetch();
      registerFont('serif', {}, '/broken.json', '/broken.png', { lazy: true }).catch(() => {});
      await expect(warmRender({ render: sceneArgs() })).rejects.toThrow(/serif/);
    });

    it('rejects, rather than throws, for a render the renderer would refuse', async () => {
      const bad = { ...sceneArgs(), scale: { x: 0, y: 1 } };
      let result: Promise<void> | undefined;
      expect(() => { result = warmRender({ render: bad }); }).not.toThrow();
      await expect(result).rejects.toThrow(/scale\.x/);
    });

    it('takes commands already built', async () => {
      const fetch = stubFetch();
      void registerFont('serif', {}, '/serif.json', '/serif.png', { lazy: true });
      void registerFont('other', {}, '/other.json', '/other.png', { lazy: true });
      await warmRender({ commands: [COMMANDS[0]] });
      expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/serif.json', '/serif.png']);
    });

    it('lets an explicit list replace what it derived', async () => {
      const fetch = stubFetch();
      void registerFont('serif', {}, '/serif.json', '/serif.png', { lazy: true });
      await warmRender({ render: sceneArgs(), families: [], paintKinds: [] });
      expect(fetch).not.toHaveBeenCalled();
      expect(getPaintKind('mesh-gradient')).toBeUndefined();
    });
  });
});
