import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { TileGrip } from './TileGrip';
import { Workspace } from './Workspace';

const VIEWPORT = { w: 800, h: 600 };

describe('Workspace reorderable', () => {
  test('turning it on and off remounts no tile and no grip', async () => {
    const mounts: string[] = [];
    function Probe({ label }: { label: string }) {
      useEffect(() => void mounts.push(label), [label]);
      return <span>{label}</span>;
    }
    const tiles = (reorderable: boolean) => (
      <Workspace ids={['a', 'b']} reorderable={reorderable} viewport={VIEWPORT}>
        <Probe label="a" />
        <TileGrip data-testid="grip">
          <Probe label="b" />
        </TileGrip>
      </Workspace>
    );
    const { rerender } = await renderSettled(tiles(false), { wrapper: withIcons });
    expect(mounts.sort()).toEqual(['a', 'b']);
    await act(async () => rerender(tiles(true)));
    expect(screen.getByTestId('grip')).toHaveAttribute('data-lk-tile-grip');
    await act(async () => rerender(tiles(false)));
    expect(screen.getByTestId('grip')).not.toHaveAttribute('data-lk-tile-grip');
    expect(mounts).toEqual(['a', 'b']);
  });

  test('reports only the children’s ids, not a tile panel’s', async () => {
    // jsdom lays nothing out, so a drop is hit-tested against each element's inline rect.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const { left, top, width, height } = (this as HTMLElement).style;
      const px = (value: string) => Number.parseFloat(value) || 0;
      return new DOMRect(px(left), px(top), px(width), px(height));
    });
    const onReorder = vi.fn();
    await renderSettled(
      <Workspace
        ids={['a', 'b']}
        panels={[{ key: 'p', title: 'P', as: 'tile' }]}
        reorderable
        onReorder={onReorder}
        viewport={VIEWPORT}
      >
        <TileGrip data-testid="drag-a">a</TileGrip>
        <TileGrip>b</TileGrip>
      </Workspace>,
      { wrapper: withIcons },
    );
    const grip = screen.getByTestId('drag-a');
    await act(async () => {
      fireEvent.pointerDown(grip, { pointerId: 1, clientX: 100, clientY: 150 });
      fireEvent.pointerMove(grip, { pointerId: 1, clientX: 760, clientY: 150 });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      fireEvent.pointerUp(grip, { pointerId: 1, clientX: 760, clientY: 150 });
    });
    expect(onReorder).toHaveBeenCalledWith(['b', 'a']);
    vi.restoreAllMocks();
  });

  test('draws a child whose id reads like a panel’s as the child', async () => {
    await renderSettled(
      <Workspace ids={['lk-panel-x']} viewport={VIEWPORT}>
        <span>child</span>
      </Workspace>,
      { wrapper: withIcons },
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
