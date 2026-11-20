import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LensSlot } from './LensSlot';
import type { LensCapture, LensSource, LensSourceRequest } from './lensSource';
import { LENS_DEFAULTS, type LensIds } from './lensTypes';

const painted = vi.hoisted(
  () => [] as { base: FakeBitmap; compared: FakeBitmap; open: boolean[] }[],
);

vi.mock('./difference', () => ({
  paintDifference: (_el: HTMLCanvasElement, base: LensCapture, compared: LensCapture) => {
    const a = base.bitmap as unknown as FakeBitmap;
    const b = compared.bitmap as unknown as FakeBitmap;
    painted.push({ base: a, compared: b, open: [!a.closed, !b.closed] });
    return 0;
  },
}));

interface FakeBitmap {
  name: string;
  width: number;
  height: number;
  closed: boolean;
  close(): void;
}

const bitmap = (name: string): FakeBitmap => ({
  name,
  width: 4,
  height: 4,
  closed: false,
  close() {
    this.closed = true;
  },
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  painted.length = 0;
});

it('paints Difference from its own copies, though the source closes a capture while the other is still coming', async () => {
  const copies: FakeBitmap[] = [];
  vi.stubGlobal('createImageBitmap', async (from: FakeBitmap) => {
    if (from.closed) throw new DOMException('closed', 'InvalidStateError');
    const copy = bitmap(`copy of ${from.name}`);
    copies.push(copy);
    return copy;
  });
  const base = bitmap('base');
  let answerCompared: (() => void) | undefined;
  const capture = (r: LensSourceRequest<string>): Promise<LensCapture> => {
    const got = (b: FakeBitmap) => ({
      bitmap: b as unknown as ImageBitmap,
      dpr: 1,
      box: { width: 4, height: 4 },
      at: { x: 2, y: 2 },
    });
    if (r.conditions === null) return Promise.resolve(got(base));
    return new Promise((resolve) => {
      answerCompared = () => resolve(got(bitmap('compared')));
    });
  };
  const pixels: LensSource<string> = {
    kind: 'pixels',
    produces: 'pixels',
    label: () => 'Pixels',
    status: () => true,
    subscribe: () => () => {},
    attach: () => ({ update() {}, detach() {} }),
    capture,
  };
  render(
    <LensSlot
      lens={{ lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' } as LensIds}
      settings={{ ...LENS_DEFAULTS, source: 'pixels', compare: 'b', view: 'difference' }}
      sources={{ pixels }}
      reticle={{ x: 10, y: 20 }}
      size={{ width: 40, height: 40 }}
      describe={(c) => `vs ${c}`}
    />,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  // The base side's next capture lands before the compared one: the source closes what it handed out.
  base.close();
  await act(async () => {
    answerCompared?.();
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(painted.map((p) => [p.base.name, p.compared.name, ...p.open])).toEqual([
    ['copy of base', 'copy of compared', true, true],
  ]);
  // Its copies are its own to close, once painted.
  expect(copies.map((c) => c.closed)).toEqual([true, true]);
});
