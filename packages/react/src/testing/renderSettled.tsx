import type { ReactElement } from 'react';
import { act, type RenderOptions, type RenderResult, render } from '@testing-library/react';

/**
 * `render`, inside an async `act` that also covers the microtasks the mount queued. A
 * component reading an external store that publishes on a microtask — every windease
 * container does — re-renders there, after a plain `render` has already left `act`.
 */
export async function renderSettled(ui: ReactElement, options?: RenderOptions): Promise<RenderResult> {
  let result!: RenderResult;
  await act(async () => {
    result = render(ui, options);
  });
  return result;
}
