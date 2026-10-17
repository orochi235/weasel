import { act, fireEvent, screen } from '@testing-library/react';
import { type MenuDef } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from './Lab';
import { type LabContextValue, useLabContext } from './LabContext';
import type { LabProps } from './labProps';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const Staged = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Staged',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
  stage: {
    size: { width: 240, height: 160 },
    initialView: { zoom: 1, pan: { x: 0, y: 0 } },
  },
});

const MENUS: readonly MenuDef[] = [
  { id: 'lab', when: {}, menu: pref.group('', { dark: pref.action('lab.mode.dark') }) },
];

let lab: LabContextValue | null = null;
function Grab() {
  lab = useLabContext();
  return null;
}

function mount(props: Partial<LabProps> = {}) {
  return renderSettled(
    <Lab {...({ instruments: [Staged], defaultInstrument: 'Staged', ...props } as LabProps)}>
      <Grab />
    </Lab>,
  );
}

const stages = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('.lk-stage'),
];

describe('a lab’s context menus', () => {
  it('opens on a right-click over a trial’s camera and runs a row', async () => {
    const { container } = await mount({ contextMenus: MENUS });
    const host = stages(container)[0] as HTMLElement;
    await act(async () => {
      fireEvent.contextMenu(host, { clientX: 10, clientY: 10 });
    });
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Dark');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Dark' }));
    });
    expect(lab?.mode).toBe('dark');
  });

  it('keeps the browser’s own menu in a lab that declares none', async () => {
    const { container } = await mount();
    const host = stages(container)[0] as HTMLElement;
    let notPrevented = false;
    await act(async () => {
      notPrevented = fireEvent.contextMenu(host, { clientX: 10, clientY: 10 });
    });
    expect(notPrevented).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('mounts one menu host for the lab, whatever the number of trials', async () => {
    const { container } = await mount({ contextMenus: MENUS, opening: ['Staged', 'Staged'] });
    const hosts = stages(container);
    expect(hosts.length).toBe(2);
    await act(async () => {
      fireEvent.contextMenu(hosts[1] as HTMLElement, { clientX: 20, clientY: 20 });
    });
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });
});
