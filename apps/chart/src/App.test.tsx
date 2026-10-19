import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider } from '@weasel-js/core';
import { iconsWrapper } from '@weasel-js/ui/testing/withIcons';
import { App } from './App';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) },
  );
});
afterEach(cleanup);

describe('App', () => {
  it('shows the File, Edit and Mode menus and a canvas', () => {
    const { container } = render(
      <DepRegistryProvider>
        <ActionsProvider>
          <App />
        </ActionsProvider>
      </DepRegistryProvider>,
      { wrapper: iconsWrapper() },
    );
    for (const name of ['File', 'Edit', 'Mode']) {
      expect(screen.getByRole('menuitem', { name })).toBeTruthy();
    }
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
