import { act, fireEvent, screen } from '@testing-library/react';
import { pref } from '@weasel-js/prefs';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { AddIcon } from '@weasel-js/ui';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LabContribution } from '../chrome';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from './Lab';
import { type LabContextValue, useLabContext } from './LabContext';
import type { LabProps } from './labProps';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

afterEach(() => {
  history.replaceState(null, '', '/');
});

const Stub = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
});

let lab: LabContextValue | null = null;
function Grab() {
  lab = useLabContext();
  return null;
}

function mount(props: Partial<LabProps> = {}) {
  return renderSettled(
    <Lab {...({ instruments: [Stub], defaultInstrument: 'Stub', ...props } as LabProps)}>
      <Grab />
    </Lab>,
  );
}

const title = (name: string) =>
  screen
    .getAllByRole('menuitem', { name })
    .find((el) => el.parentElement?.getAttribute('role') === 'menubar') as HTMLElement;
const row = (name: string) => {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')];
  const found = rows.find((el) => el.textContent?.includes(name));
  if (!found)
    throw new Error(`no row ${name} among ${rows.map((el) => el.textContent).join(', ')}`);
  return found;
};
const open = async (name: string) => {
  await act(async () => {
    fireEvent.pointerDown(title(name));
  });
};
const press = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

describe('the lab’s menu bar', () => {
  it('draws a menubar with Lab and View above the header', async () => {
    const { container } = await mount();
    const bar = screen.getByRole('menubar', { name: 'Lab menu bar' });
    expect([...bar.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent)).toEqual([
      'Lab',
      'View',
    ]);
    const header = container.querySelector('.lk-shell-header');
    if (!header) throw new Error('no header');
    expect(bar.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('runs Add trial from the Lab menu', async () => {
    await mount();
    const before = lab?.trials.length ?? 0;
    await open('Lab');
    await press(row('Add trial'));
    expect(lab?.trials.length).toBe(before + 1);
  });

  it('checks the current mode under View › Theme', async () => {
    await mount({ mode: 'dark' });
    await open('View');
    await press(row('Theme'));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('shows forge-style header items and runs them', async () => {
    const onActivate = vi.fn();
    const labChrome: LabContribution[] = [
      {
        id: 'x-hello',
        region: 'header',
        group: 'story',
        item: { icon: AddIcon, label: 'Hello', onActivate },
      },
    ];
    await mount({ labChrome });
    await open('Lab');
    await press(row('Hello'));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('opens a declared menu by its access letter', async () => {
    const schema = pref.group('', {
      tools: {
        ...pref.group('Tools', { add: pref.action('lab.add.Stub') }, { as: 'menu' }),
        access: 't',
      },
    });
    await mount({ menus: { schema } });
    expect(screen.getByRole('menubar').textContent).toBe('LabToolsView');
    await act(async () => {
      fireEvent.keyDown(document.body, { key: '†', code: 'KeyT', altKey: true });
    });
    expect(screen.getByRole('menu').getAttribute('aria-labelledby')).toBe(title('Tools').id);
  });

  it("binds a declared menu's enum to values and onChange", async () => {
    const onChange = vi.fn();
    const schema = pref.group('', {
      tools: pref.group('Tools', { units: pref.enum('Units', 'px', ['px', 'mm']) }, { as: 'menu' }),
    });
    await mount({ menus: { schema, values: { 'tools.units': 'mm' }, onChange } });
    await open('Tools');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Mm' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await press(screen.getByRole('menuitemcheckbox', { name: 'Px' }));
    expect(onChange).toHaveBeenCalledWith('tools.units', 'px');
  });

  it.each([
    ['header={false}', { header: false }],
    ['present', { present: true }],
    ['menuBar={false}', { menuBar: false }],
  ] as const)('draws no menu bar, and F10 does nothing, with %s', async (_, props) => {
    await mount(props);
    expect(screen.queryByRole('menubar')).toBeNull();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'F10', code: 'F10' });
    });
    expect(document.activeElement?.getAttribute('role')).not.toBe('menuitem');
  });

  it('keeps every header control in the header', async () => {
    const { container } = await mount();
    const header = container.querySelector('.lk-shell-header');
    if (!header) throw new Error('no header');
    expect(header.contains(screen.getByRole('button', { name: 'Add trial' }))).toBe(true);
    expect(header.contains(screen.getByRole('toolbar', { name: 'Zoom' }))).toBe(true);
    expect(header.contains(screen.getByRole('button', { name: /^Theme: / }))).toBe(true);
  });
});
