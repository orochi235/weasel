import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FromFrame } from '../../protocol/messages';
import { describeSchema } from '../../protocol/schema';
import type { IndexEntry } from '../../story/types';
import { connectFrame, flush, installResizeObserver } from '../labHarness';
import { Workshop } from '../Workshop';
import { revealVar, subscribeReveal } from './reveal';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const ready: FromFrame = { type: 'ready', schema: describeSchema(f.schema({})), layout: 'centered', viewport: null };

afterEach(() => {
  history.replaceState(null, '', '/');
});

async function openTrial() {
  location.hash = '#/x--a';
  renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
  await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > A' })).toBeInTheDocument());
  const iframe = screen.getByRole('region', { name: 'Trial X > A' }).querySelector('iframe.fg-frame-view');
  const link = connectFrame(iframe as HTMLIFrameElement);
  link.frame.send(ready);
  await flush();
  return link;
}

const vars = () => within(screen.getByRole('region', { name: 'CSS Vars' }));

describe('revealVar', () => {
  it('opens the CSS vars panel at the token', async () => {
    const { frame } = await openTrial();
    frame.send({ type: 'vars', vars: [{ name: '--wzl-bg', value: 'rgb(1, 2, 3)', overridden: false, used: true }] });
    await flush();
    expect(screen.queryByRole('region', { name: 'CSS Vars' })).toBeNull();

    act(() => revealVar('--wzl-bg'));
    await waitFor(() => expect(vars().getByRole('group', { name: '--wzl-bg' })).toHaveAttribute('data-revealed'));
    // Not a theme token, so the panel turns to the story's own vars to show it.
    expect(vars().getByRole('radio', { name: 'Story' })).toBeChecked();
  });

  it('clears a filter hiding the token and opens its folded section', async () => {
    await openTrial();
    fireEvent.click(await screen.findByRole('button', { name: 'CSS Vars panel' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'CSS Vars' })).toBeInTheDocument());
    fireEvent.click(vars().getByRole('button', { name: 'Motion' }));
    fireEvent.change(vars().getByLabelText('Filter'), { target: { value: 'gray' } });
    expect(vars().queryByRole('group', { name: '--wzl-motion-fast' })).toBeNull();

    act(() => revealVar('--wzl-motion-fast'));
    await waitFor(() => expect(vars().getByRole('group', { name: '--wzl-motion-fast' })).toHaveAttribute('data-revealed'));
    expect(vars().getByLabelText('Filter')).toHaveValue('');
  });

  it('hands a reveal no panel has marked to a later subscriber, and no longer once one has', async () => {
    revealVar('--wzl-held');
    const early = vi.fn();
    subscribeReveal(early)();
    expect(early).toHaveBeenCalledWith('--wzl-held');

    await openTrial();
    act(() => revealVar('--wzl-motion-fast'));
    await waitFor(() => expect(vars().getByRole('group', { name: '--wzl-motion-fast' })).toHaveAttribute('data-revealed'));
    const late = vi.fn();
    subscribeReveal(late)();
    expect(late).not.toHaveBeenCalled();
  });

  it('drops a reveal of a token the open panel lists nowhere, so no later mount reopens it', async () => {
    await openTrial();
    fireEvent.click(await screen.findByRole('button', { name: 'CSS Vars panel' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'CSS Vars' })).toBeInTheDocument());
    act(() => revealVar('--wzl-listed-nowhere'));
    const late = vi.fn();
    subscribeReveal(late)();
    expect(late).not.toHaveBeenCalled();
  });
});
