import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

const commits = vi.hoisted(() => [] as { id: string; params: unknown; batch: string | null }[]);
const batching = vi.hoisted(() => ({ label: null as string | null }));
vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  useOngoingAction: (id: string) => ({
    input: () => {},
    commit: (params: unknown) => { commits.push({ id, params, batch: batching.label }); },
    cancel: () => {},
  }),
  useActionsRegistry: () => ({
    begin: (id: string, params: unknown) => ({ end: () => { commits.push({ id, params, batch: batching.label }); } }),
  }),
}));

import { ActiveSwatches } from './ActiveSwatches';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { renderWithIcons } from './testIcons';

const scene = {
  batch: <T,>(label: string, fn: () => T): T => {
    batching.label = label;
    try { return fn(); } finally { batching.label = null; }
  },
};

beforeEach(() => { commits.length = 0; });

function mount() {
  renderWithIcons(
    <ColorContextProvider initialFocus="fill">
      <ActiveSwatches scene={scene} />
    </ColorContextProvider>,
  );
  return screen.getByRole('button', { name: 'None' });
}

const trigger = (name: string) => screen.getByRole('button', { name, hidden: true });
const chip = (name: string) => trigger(name).parentElement!;

/** Opens a chip's paint editor. */
function open(name: string): HTMLElement {
  fireEvent.click(trigger(name));
  return screen.getByRole('dialog', { name: `${name} editor` });
}

describe('ActiveSwatches', () => {
  it('renders one paint editor trigger per paint role', () => {
    mount();
    expect(trigger('Fill')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger('Stroke')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('None toggles the focused swatch and reports it as pressed', () => {
    const none = mount();
    expect(none.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(none);
    expect(none.getAttribute('aria-pressed')).toBe('true');
    expect(chip('Fill').hasAttribute('data-none')).toBe(true);
    fireEvent.click(none);
    expect(none.getAttribute('aria-pressed')).toBe('false');
  });

  it('shift-click on a swatch toggles it to none without opening the editor', () => {
    mount();
    fireEvent.click(trigger('Stroke'), { shiftKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chip('Stroke').hasAttribute('data-none')).toBe(true);
    expect(chip('Stroke').hasAttribute('data-target')).toBe(true);
  });

  it('Swap exchanges the paints', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
    const input = open('Fill').querySelector('input[type="color"]') as HTMLInputElement;
    expect(input).toHaveValue('#000000');
  });

  it('turns the active fill into a gradient, and edits it as one', () => {
    mount();
    fireEvent.click(within(open('Fill')).getByRole('radio', { name: 'Linear' }));
    const stop = within(screen.getByRole('dialog', { name: 'Fill editor' })).getByLabelText('Stop 1');
    fireEvent.input(stop, { target: { value: '#00ff00' } });
    fireEvent.blur(stop);
    expect(within(screen.getByRole('dialog', { name: 'Fill editor' })).getByLabelText('Stop 1')).toHaveValue('#00ff00');
  });

  it('paints the selection with the None it toggles to, as the paint editor does', () => {
    const none = mount();
    fireEvent.click(none);
    expect(commits).toEqual([{ id: 'setFill', params: { paint: null }, batch: 'Set fill' }]);
    fireEvent.click(trigger('Stroke'), { shiftKey: true });
    expect(commits[1]).toEqual({ id: 'setStroke', params: { paint: null }, batch: 'Set stroke' });
  });

  it('paints the selection with the swapped paints, in one undo entry', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
    expect(commits.map((c) => [c.id, c.batch])).toEqual([['setFill', 'Swap fill and stroke'], ['setStroke', 'Swap fill and stroke']]);
    expect(commits[0]!.params).toMatchObject({ paint: { color: expect.stringMatching(/^#000000/) } });
  });
});
