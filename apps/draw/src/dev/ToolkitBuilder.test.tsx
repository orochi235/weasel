import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ActionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ToolkitBuilder } from './ToolkitBuilder';
import { renderWithIcons } from '../testIcons';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});

/** The count a widget's title carries, as in "Tools · 12". */
async function countIn(title: string): Promise<number> {
  const heading = await screen.findByText(new RegExp(`^${title} · \\d+$`));
  return Number(heading.textContent!.split(' · ')[1]);
}

function mount(): void {
  renderWithIcons(
    <DepRegistryProvider>
      <ActionsProvider>
        <SelectionContextProvider>
          <ToolkitBuilder />
        </SelectionContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
}

describe('ToolkitBuilder', () => {
  beforeEach(() => window.history.replaceState(null, '', '#/dev/toolkits'));

  it('fills each widget from the canvas it mounts', async () => {
    mount();
    await waitFor(async () => expect(await countIn('Tools')).toBeGreaterThan(0));
    expect(await countIn('Routes')).toBeGreaterThan(0);
    expect(await countIn('Actions')).toBeGreaterThan(0);
    expect(await countIn('Resolution')).toBeGreaterThan(0);
    await countIn('Conflicts');
    expect(await screen.findByText(/^\d+ records?$/)).toBeTruthy();
  });

  it("mounts path-tools' tools and actions while its switch is on", async () => {
    mount();
    expect(await screen.findByText('useGirthTool')).toBeTruthy();
    expect(await screen.findByText('useSmudgeBrushTool')).toBeTruthy();
    const withPaths = await countIn('Actions');
    fireEvent.click(screen.getByRole('switch', { name: 'path-tools' }));
    await waitFor(() => expect(screen.queryByText('useGirthTool')).toBeNull());
    expect(await countIn('Actions')).toBeLessThan(withPaths);
    expect(window.location.hash).toBe('#/dev/toolkits?base=draw&tools=tools:shape&paths=0');
  });

  it('mounts path-tools beside every tool preset the hash names', async () => {
    window.history.replaceState(null, '', '#/dev/toolkits?base=draw&tools=tools:shape,tools:draw,tools:type,tools:page');
    mount();
    expect(await screen.findByText('useGirthTool')).toBeTruthy();
    expect(await screen.findByText('usePenTool')).toBeTruthy();
  });

  it('mounts a tool preset while its switch is on', async () => {
    mount();
    expect(await screen.findByText('useRectTool')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'tools:shape' }));
    await waitFor(() => expect(screen.queryByText('useRectTool')).toBeNull());
    expect(window.location.hash).toBe('#/dev/toolkits?base=draw&tools=');
  });
});
