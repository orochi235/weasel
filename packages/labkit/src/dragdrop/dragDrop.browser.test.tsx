import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import '../lab/presentation.browser.test.less';
import { cleanup, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

// A palette drag holds its press captured to the palette item, so in a browser
// the canvas never hears the pointer at all: the drop reaches the canvas's
// dispatcher only as a carry. jsdom's capture does nothing, and its layout is
// stubbed, so only here does a real drag land at a real point.

afterEach(cleanup);

interface DropState {
  items: { id: string; x: number; y: number }[];
}

const Drop = defineInstrument<DropState, Record<string, never>>({
  name: 'Drop',
  defaultConfig: () => ({}),
  initialState: () => ({ items: [] }),
  configSchema: () => [],
  render: ({ state }) => (
    <output data-testid="items">{state.items.map((i) => `${i.id}@${i.x},${i.y}`).join(' ')}</output>
  ),
  canvas: {
    worldSpec: { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' },
    initialView: { zoom: 1, pan: { x: 0, y: 0 } },
    layers: [{ id: 'main', draw: () => undefined }],
  },
  dragDrop: {
    palette: [{ id: 'a', label: 'Item A' }],
    onDrop: (world, item, state) => ({
      items: [...state.items, { id: item.id, x: Math.round(world.x), y: Math.round(world.y) }],
    }),
  },
});

test('a palette item dragged onto the canvas drops at the world point it was released on', async () => {
  const { container } = renderWithIcons(
    <div className="lk-present-frame">
      <Lab instruments={[Drop]} defaultInstrument="Drop" />
    </div>,
  );
  const stack = () => container.querySelector('.lk-canvas-stack') as HTMLElement;
  await expect.poll(() => stack()?.getBoundingClientRect().width ?? 0).toBeGreaterThan(0);
  const r = stack().getBoundingClientRect();

  // 30px right of the canvas's center and 20px above it, at zoom 1 with y up.
  await userEvent.dragAndDrop(screen.getByRole('button', { name: 'Item A' }), stack(), {
    targetPosition: { x: r.width / 2 + 30, y: r.height / 2 - 20 },
  });

  await expect.poll(() => screen.getByTestId('items').textContent).toMatch(/^a@/);
  // The pointer lands on a whole pixel, and the canvas's center need not be one.
  const [x, y] = screen.getByTestId('items').textContent!.slice(2).split(',').map(Number);
  expect(Math.abs(x! - 30)).toBeLessThanOrEqual(1);
  expect(Math.abs(y! - 20)).toBeLessThanOrEqual(1);
  expect(container.querySelector('.lk-drag-ghost')).toBeNull();
});

test('a palette item released off the canvas drops nothing', async () => {
  const { container } = renderWithIcons(
    <div className="lk-present-frame">
      <Lab instruments={[Drop]} defaultInstrument="Drop" />
    </div>,
  );
  const palette = await screen.findByRole('button', { name: 'Item A' });
  await expect.poll(() => container.querySelector('.lk-canvas-stack')?.getBoundingClientRect().width ?? 0)
    .toBeGreaterThan(0);

  await userEvent.dragAndDrop(palette, palette, { targetPosition: { x: 2, y: 2 } });

  expect(screen.getByTestId('items').textContent).toBe('');
  expect(container.querySelector('.lk-drag-ghost')).toBeNull();
});
