import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { THEME_SOURCES } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FromFrame, ToFrame } from '../../protocol/messages';
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
  vi.unstubAllGlobals();
});

/** A theme store answering GET with the built weasel definition at `h1`, and PUT with `put`. */
function stubStore(put: { status: number; body: unknown }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, ...(init ? { init } : {}) });
      const answer =
        init?.method === 'PUT' ? put : { status: 200, body: { name: 'weasel', hash: 'h1', emits: true, definition: THEME_SOURCES.weasel } };
      return new Response(JSON.stringify(answer.body), { status: answer.status });
    }),
  );
  return calls;
}

async function editFontBase(value: string) {
  const font = row(vars(), 'font');
  const base = font.getByRole('textbox', { name: 'font base' });
  act(() => {
    fireEvent.change(base, { target: { value } });
    fireEvent.blur(base);
  });
  await flush();
  return font;
}

function trial(name: string) {
  return within(screen.getByRole('region', { name: `Trial X > ${name}` }));
}

/** The lab's CSS Vars panel, which follows the focused trial. */
function vars() {
  return within(screen.getByRole('region', { name: 'CSS Vars' }));
}

async function openTrial(name: string) {
  await waitFor(() => expect(screen.getByRole('region', { name: `Trial X > ${name}` })).toBeInTheDocument());
  const iframe = screen.getByRole('region', { name: `Trial X > ${name}` }).querySelector('iframe.fg-frame-view');
  const link = connectFrame(iframe as HTMLIFrameElement);
  link.frame.send(ready);
  await flush();
  return { ...link, iframe: iframe as HTMLIFrameElement };
}

function row(scope: ReturnType<typeof vars>, name: string) {
  return within(scope.getByRole('group', { name }));
}

const setsOf = (received: { type: string }[]) => received.filter((m) => m.type === 'vars.set');
type VarsSet = Extract<ToFrame, { type: 'vars.set' }>;

describe('CssVarsPanel', () => {
  it('lists the theme tokens and sends an edit, then its reset, through its trial’s frame', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    expect(trial('A').queryByRole('region', { name: 'CSS Vars' })).toBeNull();
    const panel = vars();
    expect(panel.getByText('X > A')).toBeInTheDocument();
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

  it('regenerates every step of a theme scale from a new base, with the theme’s own rule', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    const font = row(vars(), 'font');
    const base = font.getByRole('textbox', { name: 'font base' });
    expect(base).toHaveValue('13');
    expect(font.getByRole('textbox', { name: '--wzl-font-size-2xs factor' })).toHaveValue('0.66');

    act(() => {
      fireEvent.change(base, { target: { value: '15' } });
      fireEvent.blur(base);
    });
    await flush();
    const sets = setsOf(received) as Extract<ToFrame, { type: 'vars.set' }>[];
    expect(Object.fromEntries(sets.map((m) => [m.name, m.value]))).toEqual({
      '--wzl-font-size-2xs': '10px',
      '--wzl-font-size-xs': '12px',
      '--wzl-font-size-sm': '13px',
      '--wzl-font-size-md': '15px',
      '--wzl-font-size-lg': '18px',
      '--wzl-font-size-xl': '23px',
    });
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue('15');

    fireEvent.click(font.getByRole('button', { name: 'Reset font' }));
    await flush();
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue('13');
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
    await waitFor(() => expect(vars().getByText('X > B')).toBeInTheDocument());

    fireEvent.pointerDown(screen.getByRole('region', { name: 'Trial X > A' }));
    await waitFor(() => expect(vars().getByText('X > A')).toBeInTheDocument());
    fireEvent.change(vars().getByLabelText('Filter'), { target: { value: 'gray-50' } });
    fireEvent.change(row(vars(), '--wzl-gray-50').getByRole('textbox'), { target: { value: 'red' } });
    await flush();
    expect(setsOf(first.received)).toEqual([{ type: 'vars.set', name: '--wzl-gray-50', value: 'red' }]);
    expect(setsOf(second.received)).toEqual([]);

    fireEvent.pointerDown(screen.getByRole('region', { name: 'Trial X > B' }));
    await waitFor(() => expect(vars().getByText('X > B')).toBeInTheDocument());
    expect(row(vars(), '--wzl-gray-50').getByRole('textbox')).toHaveValue('#f5f5f6');

    const again = connectFrame(first.iframe);
    again.frame.send(ready);
    await flush();
    expect(again.received.map((m) => m.type)).toEqual(['vars.set', 'init']);
    expect(again.received[0]).toEqual({ type: 'vars.set', name: '--wzl-gray-50', value: 'red' });
  });

  it('saves a font base edit into the current density’s seed, then drops the overrides the theme now carries', async () => {
    location.hash = '#/x--a';
    const calls = stubStore({ status: 200, body: { status: 'saved', hash: 'h2', issues: [], regenerated: true, problems: [] } });
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    await editFontBase('15');

    fireEvent.click(vars().getByRole('button', { name: 'Save scales to theme' }));
    await waitFor(() => expect(vars().getByRole('status')).toHaveTextContent('Saved to themes/weasel.json.'));
    const put = calls.find((c) => c.init?.method === 'PUT');
    expect(put?.url).toMatch(/\/__theme\/weasel$/);
    const body = JSON.parse(String(put?.init?.body));
    expect(body.hash).toBe('h1');
    expect(body.definition.seeds['ui-base']).toEqual({ by: 'density', compact: 11, comfortable: 15, roomy: 15 });
    expect(body.definition.scales['font-size'].base).toBe('{seeds.ui-base}');

    await flush();
    const cleared = (setsOf(received) as VarsSet[]).filter((m) => m.value === null);
    expect(cleared.map((m) => m.name).sort()).toEqual(
      ['2xs', 'xs', 'sm', 'md', 'lg', 'xl'].map((step) => `--wzl-font-size-${step}`).sort(),
    );
    expect(vars().queryByRole('button', { name: 'Save scales to theme' })).toBeNull();
  });

  it('reports a file changed on disk and keeps the edit', async () => {
    location.hash = '#/x--a';
    stubStore({ status: 409, body: { status: 'conflict', hash: 'h9' } });
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    const font = await editFontBase('15');

    fireEvent.click(vars().getByRole('button', { name: 'Save scales to theme' }));
    await waitFor(() => expect(vars().getByRole('alert')).toHaveTextContent('changed on disk'));
    expect((setsOf(received) as VarsSet[]).some((m) => m.value === null)).toBe(false);
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue('15');
    expect(vars().getByRole('button', { name: 'Save scales to theme' })).toBeInTheDocument();
  });
});
