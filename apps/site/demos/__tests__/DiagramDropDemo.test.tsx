import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramViewProps } from '@weasel-js/diagram';

const seen = vi.hoisted(() => ({ props: null as DiagramViewProps | null }));
vi.mock('@weasel-js/diagram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/diagram')>()),
  DiagramView: (props: DiagramViewProps) => { seen.props = props; return null; },
}));

const { DiagramDropDemo } = await import('../DiagramDropDemo');

afterEach(cleanup);

describe('DiagramDropDemo', () => {
  it('keeps a note out of the row whether it is dropped from the palette or dragged in', () => {
    render(<DiagramDropDemo />);
    const { canDropItem, canReparent } = seen.props!;
    expect(canDropItem!('note', { container: 'row', index: 0, at: { x: 0, y: 0 } } as never)).toEqual({ refuse: 'Notes stay out of the row' });
    expect(canReparent!(['note-1'], 'row')).toEqual({ refuse: 'Notes stay out of the row' });
    expect(canReparent!(['step-2', 'note-1'], 'row')).toEqual({ refuse: 'Notes stay out of the row' });
    expect(canReparent!(['step-2'], 'row')).toBe(true);
    expect(canReparent!(['note-1'], 'shelf')).toEqual({ refuse: 'The shelf is locked' });
  });
});
