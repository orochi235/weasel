import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramViewProps } from '@weasel-js/diagram';

const seen = vi.hoisted(() => ({ props: null as DiagramViewProps | null }));
vi.mock('@weasel-js/diagram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/diagram')>()),
  DiagramView: (props: DiagramViewProps) => { seen.props = props; return null; },
}));

const { DiagramLayoutDemo } = await import('../DiagramLayoutDemo');

afterEach(cleanup);

const edge = (id: string) => seen.props!.specs.find((s) => s.id === id)!.data as { diagram: { waypoints?: unknown } };

describe('DiagramLayoutDemo', () => {
  it('keeps the routes a layout run reports through the rebuild that follows', () => {
    render(<DiagramLayoutDemo />);
    const waypoints = [{ x: 220, y: 260 }, { x: 300, y: 260 }];
    act(() => {
      seen.props!.onMove!([{ id: 'write', x: 200, y: 300 }], [{ id: 'edge:scale->write', waypoints, ports: {} }]);
    });
    expect(edge('edge:scale->write').diagram.waypoints).toEqual(waypoints);
  });
});
