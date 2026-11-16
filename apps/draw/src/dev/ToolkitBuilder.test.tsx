import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ActionsProvider, AmbientContributionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import { devtools } from '@weasel-js/devtools/hook';
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
          <AmbientContributionsProvider contributions={[devtools]}>
            <ToolkitBuilder />
          </AmbientContributionsProvider>
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
    expect(await screen.findByText('useKneadTool')).toBeTruthy();
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

  it('mounts one preset alone on Alt-click, and every preset on a second', async () => {
    mount();
    expect(await screen.findByText('useGirthTool')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'tools:view' }), { altKey: true });
    await waitFor(() => expect(screen.queryByText('useGirthTool')).toBeNull());
    expect(window.location.hash).toBe('#/dev/toolkits?base=draw&tools=tools:view&paths=0&text=0');
    fireEvent.click(screen.getByRole('switch', { name: 'tools:view' }), { altKey: true });
    await waitFor(() => expect(window.location.hash).not.toContain('paths=0'));
    expect(window.location.hash).not.toContain('text=0');
    expect(within(screen.getByRole('group', { name: 'Presets' })).getAllByRole('switch').every((s) => (s as HTMLInputElement).checked)).toBe(true);
  });
});
