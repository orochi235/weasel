import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FromFrame } from '../../protocol/messages';
import { describeSchema } from '../../protocol/schema';
import type { IndexEntry } from '../../story/types';
import { connectFrame, flush, installResizeObserver } from '../labHarness';
import { Workshop } from '../Workshop';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const b: IndexEntry = { id: 'x--b', title: 'X', name: 'B', exportName: 'B', file: '/x.stories.tsx' };
const ready: FromFrame = { type: 'ready', schema: describeSchema(f.schema({})), layout: 'centered', viewport: null };

afterEach(() => {
  history.replaceState(null, '', '/');
});

function trial(name: string) {
  return within(screen.getByRole('region', { name: `Trial X / ${name}` }));
}

/** The lab's CSS Vars panel, which follows the focused trial. */
function vars() {
  return within(screen.getByRole('region', { name: 'CSS Vars' }));
}

async function openTrial(name: string) {
  await waitFor(() => expect(screen.getByRole('region', { name: `Trial X / ${name}` })).toBeInTheDocument());
  const iframe = screen.getByRole('region', { name: `Trial X / ${name}` }).querySelector('iframe.fg-frame-view');
  const link = connectFrame(iframe as HTMLIFrameElement);
  link.frame.send(ready);
  await flush();
  return { ...link, iframe: iframe as HTMLIFrameElement };
}

function row(scope: ReturnType<typeof vars>, name: string) {
  return within(scope.getByRole('group', { name }));
}

const setsOf = (received: { type: string }[]) => received.filter((m) => m.type === 'vars.set');

describe('CssVarsPanel', () => {
  it('lists the theme tokens and sends an edit, then its reset, through its trial’s frame', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    expect(trial('A').queryByRole('region', { name: 'CSS Vars' })).toBeNull();
    const panel = vars();
    expect(panel.getByText('X / A')).toBeInTheDocument();
    fireEvent.change(panel.getByLabelText('Filter'), { target: { value: 'gray-50' } });
    expect(panel.queryByRole('group', { name: '--wzl-gray-100' })).toBeNull();
    const token = row(panel, '--wzl-gray-50');
    expect(token.getByRole('textbox')).toHaveValue('#f5f5f6');
    expect(token.queryByRole('button', { name: 'Reset --wzl-gray-50' })).toBeNull();

    fireEvent.change(token.getByRole('textbox'), { target: { value: '#123456' } });
    await flush();
    expect(setsOf(received)).toEqual([{ type: 'vars.set', name: '--wzl-gray-50', value: '#123456' }]);
    expect(received.filter((m) => m.type !== 'vars.set').map((m) => m.type)).toEqual(['init']);
    expect(token.getByRole('textbox')).toHaveValue('#123456');

    fireEvent.click(token.getByRole('button', { name: 'Reset --wzl-gray-50' }));
    await flush();
    expect(setsOf(received).at(-1)).toEqual({ type: 'vars.set', name: '--wzl-gray-50', value: null });
    expect(token.getByRole('textbox')).toHaveValue('#f5f5f6');
  });

  it('files the theme’s tokens into collapsible sections, with the gray ramp as one row of swatches', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await openTrial('A');
    const color = within(vars().getByRole('region', { name: 'Color' }));
    expect(within(color.getByRole('group', { name: 'gray' })).getAllByRole('button')).toHaveLength(10);
    expect(vars().getByRole('region', { name: 'Motion' })).toBeInTheDocument();
    fireEvent.click(vars().getByRole('button', { name: 'Motion' }));
    expect(vars().queryByRole('group', { name: '--wzl-motion-fast' })).toBeNull();
  });

  it('lists the vars the story’s frame reports, with a color input for a color', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { frame, received } = await openTrial('A');
    const panel = vars();
    fireEvent.click(panel.getByRole('radio', { name: 'Story' }));
    frame.send({
      type: 'vars',
      vars: [
        { name: '--gap', value: '4px', overridden: false },
        { name: '--ink', value: 'rgb(255, 0, 0)', overridden: false },
      ],
    });
    await flush();
    const gap = row(panel, '--gap');
    expect(gap.getByRole('textbox')).toHaveValue('4');
    expect(gap.queryByLabelText(/color/i)).toBeNull();
    const ink = row(panel, '--ink');
    const swatch = ink.getByLabelText(/color/i);
    expect(swatch).toHaveValue('#ff0000');
    fireEvent.change(swatch, { target: { value: '#00ff00' } });
    await flush();
    expect(setsOf(received)).toEqual([{ type: 'vars.set', name: '--ink', value: '#00ff00' }]);
  });

  it('follows the focused trial, keeping each trial’s overrides to it and sending them again when its frame reloads', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const first = await openTrial('A');
    act(() => {
      location.hash = '#/x--b';
    });
    const second = await openTrial('B');
    await waitFor(() => expect(vars().getByText('X / B')).toBeInTheDocument());

    fireEvent.pointerDown(screen.getByRole('region', { name: 'Trial X / A' }));
    await waitFor(() => expect(vars().getByText('X / A')).toBeInTheDocument());
    fireEvent.change(vars().getByLabelText('Filter'), { target: { value: 'gray-50' } });
    fireEvent.change(row(vars(), '--wzl-gray-50').getByRole('textbox'), { target: { value: 'red' } });
    await flush();
    expect(setsOf(first.received)).toEqual([{ type: 'vars.set', name: '--wzl-gray-50', value: 'red' }]);
    expect(setsOf(second.received)).toEqual([]);

    fireEvent.pointerDown(screen.getByRole('region', { name: 'Trial X / B' }));
    await waitFor(() => expect(vars().getByText('X / B')).toBeInTheDocument());
    expect(row(vars(), '--wzl-gray-50').getByRole('textbox')).toHaveValue('#f5f5f6');

    const again = connectFrame(first.iframe);
    again.frame.send(ready);
    await flush();
    expect(again.received.map((m) => m.type)).toEqual(['vars.set', 'init']);
    expect(again.received[0]).toEqual({ type: 'vars.set', name: '--wzl-gray-50', value: 'red' });
  });
});
