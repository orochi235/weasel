import { act, screen, within } from '@testing-library/react';
import { type ActionsRegistry, useActionsRegistry } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { SHORTCUT_SHEET_ID } from '@weasel-js/ui/components/ShortcutSheet';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { icon } from '../icons.gen';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from './Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const Staged = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Staged',
  initialState: () => ({}),
  render: () => null,
});
const TOOLS = [{ id: 'pen', label: 'Pen', icon: icon('ui:add') }];

let registry: ActionsRegistry | null = null;
function Grab() {
  registry = useActionsRegistry() as ActionsRegistry;
  return null;
}

describe("a lab's shortcut sheet", () => {
  it("opens on Shift+/ and lists the lab's tools and commands", async () => {
    await renderSettled(
      <Lab instruments={[Staged]} opening={['Staged']} tools={TOOLS}>
        <Grab />
      </Lab>,
      { wrapper: withIcons },
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true, bubbles: true }),
      );
    });
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(sheet).getByText('Pen')).toBeTruthy();
    expect(within(sheet).getByText('Keyboard shortcuts', { selector: 'li span' })).toBeTruthy();
  });

  it('registers none with `shortcuts={false}`', async () => {
    await renderSettled(
      <Lab instruments={[Staged]} opening={['Staged']} shortcuts={false}>
        <Grab />
      </Lab>,
      { wrapper: withIcons },
    );
    expect(registry?.list().some((a) => a.id === SHORTCUT_SHEET_ID)).toBe(false);
  });
});
