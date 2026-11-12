import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import type { View } from '@weasel-js/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { chartPrefs } from './prefs';
import { withIcons } from './testIcons';

const seen = vi.hoisted(() => ({ view: null as View | null }));

// The view is the canvas's prop, and nothing in the DOM shows where it is.
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  const { forwardRef, createElement } = await import('react');
  const Original = core.SceneCanvas as never;
  const SceneCanvas = forwardRef((props: { view?: View }, ref) => {
    seen.view = props.view ?? null;
    return createElement(Original, { ...props, ref });
  });
  return { ...core, SceneCanvas };
});

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) },
  );
});
afterEach(() => {
  cleanup();
  chartPrefs().reset();
  localStorage.clear();
});

function choose(menu: string, row: string): void {
  act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: menu })); });
  const open = screen.getAllByRole('menu').at(-1)!;
  const item = [...open.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find((el) => el.textContent?.startsWith(row));
  act(() => { fireEvent.click(item!); });
}

describe('replacing the chart', () => {
  it('fits the view to the new chart\'s first page after File › New…, wherever it was', () => {
    render(<App />, { wrapper: withIcons });
    const fitted = seen.view;
    expect(fitted).not.toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Add page/i })); });
    expect(seen.view).not.toEqual(fitted);
    choose('File', 'New…');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
    expect(seen.view).toEqual(fitted);
  });
});
