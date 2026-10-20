import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramViewProps } from '../DiagramView';

const seen: DiagramViewProps[] = [];
vi.mock('../DiagramView', () => ({
  DiagramView: (props: DiagramViewProps) => {
    seen.push(props);
    return null;
  },
}));
const released: unknown[] = [];
vi.mock('@weasel-js/core/renderer', () => ({ releaseImageSource: (source: unknown) => released.push(source) }));

import type { DiagramSpec } from '../fromData';
import { AT_COLOR, DIM } from './run';
import { EffectEditor } from './EffectEditor';
import type { EffectDoc, EffectRun } from './types';

afterEach(() => {
  cleanup();
  seen.length = 0;
  released.length = 0;
});

const doc: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
      { id: 'blur', title: 'Blur', inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
    ],
    wires: [{ id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'in' } }],
  },
  places: {},
};
const OPTIONS = { showPreviews: true };
const bitmap = () => ({ width: 8, height: 8, close() {} }) as unknown as ImageBitmap;
const view = () => seen[seen.length - 1]!;
const spec = (id: string) => view().specs.find((s: DiagramSpec) => s.id === id);

describe('EffectEditor with a run', () => {
  it('draws the run as EffectChart does, the stage it is at outlined', () => {
    const run: EffectRun = { at: 'src', stages: { src: { cost: 1.5 } } };
    render(<EffectEditor doc={doc} onChange={() => {}} run={run} />);
    expect((spec('src/cost')!.data as { text: string }).text).toBe('1.5 ms');
    expect((spec('src')!.data as { stroke: { paint: { color: string } } }).stroke.paint.color).toBe(AT_COLOR);
    expect((spec('blur')!.data as { fill: { paint: { opacity?: number } } }).fill.paint.opacity).toBeLessThan(1);
  });

  it('fades the port dots of a stage the run never reached', () => {
    render(<EffectEditor doc={doc} onChange={() => {}} run={{ stages: { src: { cost: 1 } } }} />);
    const fill = view().portOptions!.fill as (port: { nodeId: string; type?: string }) => { paint: { opacity?: number } };
    expect(fill({ nodeId: 'blur', type: 'image' }).paint.opacity).toBe(DIM);
    expect(fill({ nodeId: 'src', type: 'image' }).paint.opacity).toBeUndefined();
  });

  it('frees the texture of a preview once a newer run no longer shows it', () => {
    const first = bitmap();
    const { rerender } = render(<EffectEditor doc={doc} onChange={() => {}} look="nodeGraph" options={OPTIONS} run={{ stages: { src: { previews: { out: first } } } }} />);
    expect(released).toEqual([]);
    rerender(<EffectEditor doc={doc} onChange={() => {}} look="nodeGraph" options={OPTIONS} run={{ stages: { src: { previews: { out: bitmap() } } } }} />);
    expect(released).toEqual([first]);
  });
});
