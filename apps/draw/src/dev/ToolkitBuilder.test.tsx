import { render, screen, waitFor } from '@testing-library/react';
import { ActionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { ToolkitBuilder } from './ToolkitBuilder';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});

/** The count a widget's title carries, as in "Tools · 12". */
async function countIn(title: string): Promise<number> {
  const heading = await screen.findByText(new RegExp(`^${title} · \\d+$`));
  return Number(heading.textContent!.split(' · ')[1]);
}

describe('ToolkitBuilder', () => {
  it('fills each widget from the canvas it mounts', async () => {
    render(
      <DepRegistryProvider>
        <ActionsProvider>
          <SelectionContextProvider>
            <ToolkitBuilder />
          </SelectionContextProvider>
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    await waitFor(async () => expect(await countIn('Tools')).toBeGreaterThan(0));
    expect(await countIn('Routes')).toBeGreaterThan(0);
    expect(await countIn('Actions')).toBeGreaterThan(0);
    expect(await countIn('Resolution')).toBeGreaterThan(0);
    await countIn('Conflicts');
    await countIn('Dispatch');
  });
});
