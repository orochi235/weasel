import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

const node = (id: string, x: number) => ({ id, lines: [], width: 100, height: 40, at: { x, y: 0 } });
const specsOf = (data: DiagramData) => diagramScene(data, { layout: 'none' });
const ONE = specsOf({ nodes: [node('a', 0)], edges: [] });
const TWO = specsOf({ nodes: [node('a', 0), node('b', 200)], edges: [] });
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('DiagramView selected', () => {
  it('selects a node that arrives in the same render as the prop naming it', async () => {
    const onDelete = vi.fn();
    const view = (extra: Partial<DiagramViewProps>) => (
      <DiagramView specs={ONE} width={500} height={300} view={IDENTITY} onViewChange={() => {}} onDelete={onDelete} selected={null} {...extra} />
    );
    const { rerender } = render(view({}));
    rerender(view({ specs: TWO, selected: 'b' }));
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }));
    });
    expect(onDelete).toHaveBeenCalledWith({ nodes: ['b'], edges: [] });
  });
});
