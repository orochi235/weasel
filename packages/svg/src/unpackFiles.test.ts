import { describe, it, expect } from 'vitest';
import { RIGID_POSE_COMPOSITION, INHERIT, type IngestCtx, type Op } from '@weasel-js/core';
import { solid } from '@weasel-js/paint';
import { unpackSvgFiles } from './unpackFiles';
import { svgLeafFromKit } from './fromKit';
import { serializeSvg } from './serialize';

type Inserted = { kind: string; data: Record<string, unknown> };

/** A context whose 800-wide viewport clamps a 4000-wide file by 0.18. */
async function drop(svg: string): Promise<Inserted[]> {
  let minted = 0;
  const inserted: Inserted[] = [];
  const c = {
    point: null,
    viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    applyOps: (ops: Op[]) => { for (const op of ops) inserted.push((op.args as { node: Inserted }).node); },
    scene: { layers: [{ id: 'main' }], mintId: () => `n${minted++}`, composition: RIGID_POSE_COMPOSITION },
  } as unknown as IngestCtx;
  await unpackSvgFiles([new File([svg], 'a.svg', { type: 'image/svg+xml' })], c);
  return inserted;
}

describe('unpackSvgFiles fit-clamp', () => {
  it('scales a group\'s stroke with its leaves, and keeps an inherited stroke inherited', async () => {
    const nodes = await drop(`<svg xmlns="http://www.w3.org/2000/svg">
      <g stroke="#000" stroke-width="10" stroke-dasharray="20 10">
        <path d="M0 0H4000"/><path d="M0 9H4000" stroke-width="10"/>
      </g>
    </svg>`);
    const group = nodes.find((n) => n.kind === 'group')!;
    const [taker, own] = nodes.filter((n) => n.kind === 'mark');
    expect(taker!.data.stroke).toBe(INHERIT);
    const g = group.data.stroke as { width: number; dash: number[] };
    expect(g.width).toBeCloseTo(1.8);
    expect(g.dash[0]).toBeCloseTo(3.6);
    expect((own!.data.stroke as { width: number }).width).toBeCloseTo(1.8);
  });

  it('scales a framed text leaf\'s padding with its box', async () => {
    const framed = svgLeafFromKit({ text: 'hi', background: { paint: solid('#fff') }, padding: 100 }, { x: 0, y: 0, width: 4000, height: 400 })!;
    const nodes = await drop(serializeSvg([framed]));
    const text = nodes.find((n) => typeof n.data.text === 'string')!;
    expect(text.data.padding).toBeCloseTo(18);
  });
});
