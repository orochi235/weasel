import { act, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect } from 'react';
import { describe, expect, test } from 'vitest';
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
});
