import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeWorkbench, type WorkbenchProps } from './ThemeWorkbench';
import type { ThemeApi } from './theme/api';
import { weasel } from './theme/fixtures';
import { removePin, setPin } from './theme/model';
import type { PutResult, StoredTheme } from './theme/store';

vi.mock('./theme/exportFiles', async (importOriginal) => ({ ...(await importOriginal<typeof import('./theme/exportFiles')>()), download: vi.fn() }));

const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
const apiWith = (put: ThemeApi['put'] = vi.fn()): ThemeApi => ({ list: async () => [stored], get: async () => stored, put });
const edited = { ...weasel, description: 'edited' };

function renderBench(overrides: Partial<WorkbenchProps> = {}): WorkbenchProps {
  const props: WorkbenchProps = {
    api: apiWith(),
    themes: [stored],
    stored,
    start: { definition: weasel, baseHash: 'h1' },
    onPick: vi.fn(),
    onSaved: vi.fn(),
    onReload: vi.fn(async () => {}),
    onNew: vi.fn(() => null),
    ...overrides,
  };
  render(<ThemeWorkbench {...props} />);
  return props;
}

describe('<ThemeWorkbench>', () => {
  afterEach(cleanup);

  it('reports how many own tokens a pin overrides, and each layer in the rail', () => {
    renderBench();
    expect(screen.getByText('23 of 120 overridden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ramps/ })).toHaveTextContent('23 pinned');
  });

  it('holds Save until the draft differs from what is on disk', () => {
    renderBench();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('reads clean once an edit brings the draft back to what is on disk', async () => {
    // `setPin` appends, so disk holds gray-800 last, at the value the Pin button writes.
    const onDisk = setPin(removePin(weasel, 'gray-800'), 'gray-800', { value: '#1a1c21', type: 'color' });
    const disk: StoredTheme = { ...stored, definition: onDisk };
    renderBench({ themes: [disk], stored: disk, start: { definition: removePin(onDisk, 'gray-800'), baseHash: 'h1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Pin gray-800' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('announces a save and moves focus to the announcement', async () => {
    const put = vi.fn(async () => ({ status: 'saved', hash: 'h2', issues: [], regenerated: false, problems: [] }) as PutResult);
    renderBench({ api: apiWith(put), start: { definition: edited, baseHash: 'h1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save, with unsaved changes' }));
    const region = (await screen.findByText(/^Saved\./)).closest('[role="status"]');
    expect(region).not.toBeNull();
    expect(document.activeElement).toBe(region);
  });

  it('saves against the hash the draft began at, then reads clean', async () => {
    const put = vi.fn(async () => ({ status: 'saved', hash: 'h2', issues: [], regenerated: true, problems: [] }) as PutResult);
    const props = renderBench({ api: apiWith(put), start: { definition: edited, baseHash: 'h1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save, with unsaved changes' }));
    expect(put).toHaveBeenCalledWith('weasel', edited, 'h1');
    expect(await screen.findByText(/^Saved\./)).toBeInTheDocument();
    expect(props.onSaved).toHaveBeenCalledWith({ ...stored, hash: 'h2', definition: edited });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('offers the three export formats', async () => {
    renderBench();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Emitted CSS', 'Definition', 'DTCG']));
  });

  it('says why an export fails, in the dialog', async () => {
    // Derives fine; only the CSS emitter rejects two axes carrying a color scheme.
    const twoSchemes: ThemeDefinition = {
      name: 'two-schemes',
      axes: {
        mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
        paper: { default: 'plain', values: { plain: { scheme: 'light' } } },
      },
    };
    const theme: StoredTheme = { name: 'two-schemes', hash: 'h1', emits: true, definition: twoSchemes };
    renderBench({ themes: [theme], stored: theme, start: { definition: twoSchemes, baseHash: 'h1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Emitted CSS' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('only one axis may carry a color scheme, but mode and paper do');
  });

  it('offers to reload when the file moved on since the draft began', async () => {
    const put = vi.fn(async () => ({ status: 'conflict', hash: 'h9' }) as PutResult);
    const props = renderBench({ api: apiWith(put), start: { definition: edited, baseHash: 'h0' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save, with unsaved changes' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('changed on disk');
    await userEvent.click(within(status).getByRole('button', { name: 'Reload from disk' }));
    expect(props.onReload).toHaveBeenCalled();
  });
});
