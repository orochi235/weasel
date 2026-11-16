import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import type { ShellConfig } from '../config';
import { meta, story } from '../story/define';
import { indexId } from '../story/indexPages';
import type { IndexEntry } from '../story/types';
import { FOLLOW_APP } from './globals';
import { describeSchema } from '../protocol/schema';
import { connectFrame, flush, installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const xModule = {
  default: meta({ title: 'X' }),
  A: story({ config: f.schema({ label: f.string('hi') }), render: ({ config }) => <button type="button">{config.label}</button> }),
};
const importers = () => ({ '/x.stories.tsx': vi.fn(() => Promise.resolve(xModule as unknown as Record<string, unknown>)) });

const following: ShellConfig = {
  globals: {
    mode: {
      label: 'Mode',
      default: FOLLOW_APP,
      follows: (chrome) => chrome.mode,
      options: [
        { value: 'auto', label: 'Auto (OS)' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
    },
  },
};

describe('a trial pin set back to Lab', () => {
  const modes = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.map(([globals]) => (globals as { mode?: unknown }).mode);
  const pick = async (trigger: HTMLElement, name: string) => {
    act(() => {
      fireEvent.click(trigger);
    });
    fireEvent.click(await screen.findByRole('option', { name }));
  };
  const pin = () => screen.getAllByRole('button', { name: /Mode/ }).find((b) => !b.closest('[role=toolbar]') && b.getAttribute('aria-haspopup') === 'listbox')!;

  it.each([
    ['a story', 'x--a'],
    ['an index page', indexId('X')],
  ])('%s takes the lab’s current mode, and follows the lab’s switch afterwards', async (_kind, id) => {
    location.hash = `#/${id}`;
    const applyGlobals = vi.fn();
    renderWithIcons(
      <Workshop index={[a]} frameUrl="/frame.html" importers={importers()} setup={{ applyGlobals }} config={following} storage={createMemoryAdapter()} />,
    );
    await waitFor(() => expect(applyGlobals).toHaveBeenCalled(), { timeout: 15_000 });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Theme: Auto/ }));
    });
    await waitFor(() => expect(modes(applyGlobals).at(-1)).toBe('light'));

    await pick(pin(), 'Dark');
    await waitFor(() => expect(modes(applyGlobals).at(-1)).toBe('dark'));
    await pick(pin(), 'Lab');
    await waitFor(() => expect(modes(applyGlobals).at(-1)).toBe('light'));

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Theme: Light/ }));
    });
    await waitFor(() => expect(modes(applyGlobals).at(-1)).toBe('dark'));
    history.replaceState(null, '', '/');
  });

  it('a framed story reset to Lab takes the lab’s current mode, and follows the lab’s switch afterwards', async () => {
    location.hash = '#/x--a';
    const { container } = renderWithIcons(
      <Workshop index={[a]} frameUrl="/frame.html" config={following} storage={createMemoryAdapter()} />,
    );
    await waitFor(() => expect(container.querySelector('iframe.fg-frame-view')).not.toBeNull(), { timeout: 15_000 });
    const { frame, received } = connectFrame(container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
    frame.send({ type: 'ready', schema: describeSchema(f.schema({})), layout: 'centered', viewport: null });
    await flush();
    const mode = () => {
      const last = received.filter((m) => m.type === 'globals' || m.type === 'init').at(-1) as { globals: { mode?: unknown } } | undefined;
      return last?.globals.mode;
    };
    await waitFor(() => expect(mode()).toBe('auto'));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Theme: Auto/ }));
    });
    await waitFor(() => expect(mode()).toBe('light'));
    await pick(pin(), 'Dark');
    await waitFor(() => expect(mode()).toBe('dark'));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset Mode' }));
    });
    await waitFor(() => expect(mode()).toBe('light'));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Theme: Light/ }));
    });
    await waitFor(() => expect(mode()).toBe('dark'));
    frame.close();
    history.replaceState(null, '', '/');
  });
});
