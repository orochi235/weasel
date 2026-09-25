import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../../protocol/schema';
import type { IndexEntry } from '../../story/types';
import { connectFrame, flush, installResizeObserver } from '../labHarness';
import { Workshop } from '../Workshop';

installResizeObserver();

const entry: IndexEntry = {
  id: 'x--a',
  title: 'X',
  name: 'A',
  exportName: 'A',
  file: '/repo/packages/ui/src/X.stories.tsx',
  description: 'The plain one.',
  componentName: 'Slider',
};

function mount() {
  return render(<Workshop index={[entry]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
}

const openInfo = async () => {
  fireEvent.click(screen.getByRole('button', { name: /^Info/ }));
  return screen.findByRole('dialog');
};

describe('Get Info', () => {
  it('opens from the palette and names the focused story', async () => {
    mount();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > A' })).toBeInTheDocument());
    const dialog = await openInfo();
    expect(within(dialog).getByRole('heading', { name: 'X > A' })).toBeInTheDocument();
    expect(dialog.textContent).toContain('The plain one.');
    expect(dialog.textContent).toContain('Slider');
    expect(dialog.textContent).toContain('/repo/packages/ui/src/X.stories.tsx');
    expect(within(dialog).getByText('Library').nextElementSibling?.textContent).toBe('ui');
  });

  it('leaves the palette item unpressed — it is a command, not a mode', async () => {
    mount();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > A' })).toBeInTheDocument());
    const button = screen.getByRole('button', { name: /^Info/ });
    fireEvent.click(button);
    await screen.findByRole('dialog');
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('says args are pending until the story frame reports a schema, then lists them', async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector('iframe.fg-frame-view')).not.toBeNull());
    const pending = await openInfo();
    expect(pending.textContent).toContain('Open this story to read its args');
    fireEvent.keyDown(pending, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const { frame } = connectFrame(container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
    frame.send({
      type: 'ready',
      schema: describeSchema(f.schema({ size: f.number(4).describe('How big.') })),
      layout: 'centered',
      viewport: null,
    });
    await flush();

    const dialog = await openInfo();
    const row = within(dialog).getByRole('row', { name: /size/ });
    expect(row.textContent).toContain('How big.');
    expect(row.textContent).toContain('4');
  });

  it('closes on Escape', async () => {
    mount();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > A' })).toBeInTheDocument());
    const dialog = await openInfo();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
