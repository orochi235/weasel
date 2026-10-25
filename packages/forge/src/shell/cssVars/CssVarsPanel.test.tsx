import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FromFrame, ToFrame } from '../../protocol/messages';
import { describeSchema } from '../../protocol/schema';
import type { IndexEntry } from '../../story/types';
import { connectFrame, flush, installResizeObserver } from '../labHarness';
import { Workshop } from '../Workshop';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

installResizeObserver();

const weasel = THEME_SOURCES.weasel as ThemeDefinition;
const uiBase = weasel.seeds?.['ui-base'] as Readonly<Record<string, number | string>>;
/** The font base the panel opens on: the default density's seed. */
const fontBase = uiBase.comfortable as number;
const editedBase = fontBase + 2;
const fontSteps = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl'];
const fontFactors = weasel.scales?.['font-size']?.factors as readonly number[];

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
  await showVars();
  return { ...link, iframe: iframe as HTMLIFrameElement };
}

/** Presses the header toggle the panel is hidden behind, unless the lab remembers it pressed. */
async function showVars() {
  const toggle = await screen.findByRole('button', { name: 'CSS Vars panel' });
  if (toggle.getAttribute('aria-pressed') !== 'true') fireEvent.click(toggle);
  await waitFor(() => expect(screen.getByRole('region', { name: 'CSS Vars' })).toBeInTheDocument());
}

function row(scope: ReturnType<typeof vars>, name: string) {
  return within(scope.getByRole('group', { name }));
}

const setsOf = (received: { type: string }[]) => received.filter((m) => m.type === 'vars.set');
type VarsSet = Extract<ToFrame, { type: 'vars.set' }>;

describe('CssVarsPanel', () => {
  it('lists the theme tokens and sends an edit, then its reset, through its trial’s frame', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
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

  it('shows a token the frame has not reported at the value the theme gives it under the trial’s globals', async () => {
    location.hash = '#/x--a';
    const mode = { label: 'Mode', default: 'light', options: [{ value: 'light', label: 'Light' }] };
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" config={{ globals: { mode } }} storage={createMemoryAdapter()} />);
    await openTrial('A');
    const panel = vars();
    fireEvent.change(panel.getByLabelText('Filter'), { target: { value: 'secondary-base' } });
    // Teal in light mode; the manifest's default is dark mode's amber.
    expect(row(panel, '--wzl-secondary-base').getByRole('textbox')).toHaveValue('#3ee1cb');
  });

  it('regenerates every step of a theme scale from a new base, with the theme’s own rule', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    const font = row(vars(), 'font');
    const base = font.getByRole('textbox', { name: 'font base' });
    expect(base).toHaveValue(String(fontBase));
    expect(font.getByRole('slider', { name: '--wzl-font-size-2xs' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/px$/));

    act(() => {
      fireEvent.change(base, { target: { value: String(editedBase) } });
      fireEvent.blur(base);
    });
    await flush();
    const sets = setsOf(received) as Extract<ToFrame, { type: 'vars.set' }>[];
    expect(Object.fromEntries(sets.map((m) => [m.name, m.value]))).toEqual(
      Object.fromEntries(fontSteps.map((step, i) => [`--wzl-font-size-${step}`, `${Math.round(editedBase * fontFactors[i])}px`])),
    );
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue(String(editedBase));

    fireEvent.click(font.getByRole('button', { name: 'Reset font' }));
    await flush();
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue(String(fontBase));
  });

  it('files the theme’s tokens into collapsible sections, with the gray ramp as one row of swatches', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await openTrial('A');
    const color = within(vars().getByRole('region', { name: 'Color' }));
    expect(within(color.getByRole('group', { name: 'gray' })).getAllByRole('button')).toHaveLength(10);
    expect(vars().getByRole('region', { name: 'Motion' })).toBeInTheDocument();
    fireEvent.click(vars().getByRole('button', { name: 'Motion' }));
    expect(vars().queryByRole('group', { name: '--wzl-motion-fast' })).toBeNull();
  });

  it('lists the vars the story’s frame reports, with a color input for a color', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { frame, received } = await openTrial('A');
    const panel = vars();
    fireEvent.click(panel.getByRole('radio', { name: 'Story' }));
    frame.send({
      type: 'vars',
      vars: [
        { name: '--gap', value: '4px', overridden: false, used: true },
        { name: '--ink', value: 'rgb(255, 0, 0)', overridden: false, used: true },
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

  it('lists only the vars the story uses until asked for the rest', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { frame } = await openTrial('A');
    const panel = vars();
    fireEvent.click(panel.getByRole('radio', { name: 'Story' }));
    frame.send({
      type: 'vars',
      vars: [
        { name: '--gap', value: '4px', overridden: false, used: true },
        { name: '--noise', value: '1px', overridden: false, used: false },
      ],
    });
    await flush();
    expect(panel.queryByRole('group', { name: '--gap' })).toBeInTheDocument();
    expect(panel.queryByRole('group', { name: '--noise' })).toBeNull();
    fireEvent.click(panel.getByRole('checkbox', { name: 'Show variables the story doesn’t use' }));
    await flush();
    expect(panel.queryByRole('group', { name: '--noise' })).toBeInTheDocument();
  });

  it('follows the focused trial, keeping each trial’s overrides to it and sending them again when its frame reloads', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const first = await openTrial('A');
    // Shift-click in the tree is what opens a second trial; a hash goes into the focused one.
    fireEvent.click(screen.getByRole('radio', { name: 'Tree' }));
    const folder = screen.getByRole('treeitem', { name: /^X/ });
    if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(within(folder).getByText('X'));
    fireEvent.click(within(screen.getByRole('treeitem', { name: 'B' })).getByText('B'), { shiftKey: true });
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
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    await editFontBase(String(editedBase));

    fireEvent.click(vars().getByRole('button', { name: 'Save to theme' }));
    await waitFor(() => expect(vars().getByRole('status')).toHaveTextContent('Saved to themes/weasel.json.'));
    const put = calls.find((c) => c.init?.method === 'PUT');
    expect(put?.url).toMatch(/\/__theme\/weasel$/);
    const body = JSON.parse(String(put?.init?.body));
    expect(body.hash).toBe('h1');
    expect(body.definition.seeds['ui-base']).toEqual({ ...uiBase, comfortable: editedBase });
    expect(body.definition.scales['font-size'].base).toBe('{seeds.ui-base}');

    await flush();
    const cleared = (setsOf(received) as VarsSet[]).filter((m) => m.value === null);
    expect(cleared.map((m) => m.name).sort()).toEqual(
      fontSteps.map((step) => `--wzl-font-size-${step}`).sort(),
    );
    expect(vars().queryByRole('button', { name: 'Save to theme' })).toBeNull();
  });

  it('saves a token edited by hand where the theme writes its value out, and offers no save for one it derives', async () => {
    location.hash = '#/x--a';
    const calls = stubStore({ status: 200, body: { status: 'saved', hash: 'h2', issues: [], regenerated: true, problems: [] } });
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    const edit = async (name: string, value: string) => {
      fireEvent.change(vars().getByLabelText('Filter'), { target: { value: name.replace('--wzl-', '') } });
      fireEvent.change(row(vars(), name).getByRole('textbox'), { target: { value } });
      await flush();
    };
    await edit('--wzl-surface-sunken', '#101010');
    expect(vars().queryByRole('button', { name: 'Save to theme' })).toBeNull();
    await edit('--wzl-gray-50', '#123456');

    fireEvent.click(vars().getByRole('button', { name: 'Save to theme' }));
    await waitFor(() => expect(vars().getByRole('status')).toHaveTextContent('Saved to themes/weasel.json.'));
    const body = JSON.parse(String(calls.find((c) => c.init?.method === 'PUT')?.init?.body));
    expect(body.definition.pins['gray-50']).toEqual({ ...(weasel.pins?.['gray-50'] as object), value: '#123456' });
    expect(body.definition.semantics['surface-sunken']).toEqual(weasel.semantics?.['surface-sunken']);

    await flush();
    const cleared = (setsOf(received) as VarsSet[]).filter((m) => m.value === null);
    expect(cleared.map((m) => m.name)).toEqual(['--wzl-gray-50']);
    expect(vars().queryByRole('button', { name: 'Save to theme' })).toBeNull();
  });

  it('saves a token that differs by mode into the branch the OS scheme picks while the trial’s mode is Auto', async () => {
    location.hash = '#/x--a';
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('light'),
      addEventListener() {},
      removeEventListener() {},
    }));
    const calls = stubStore({ status: 200, body: { status: 'saved', hash: 'h2', issues: [], regenerated: true, problems: [] } });
    const mode = { label: 'Mode', default: 'auto', options: ['auto', 'light', 'dark'].map((value) => ({ value, label: value })) };
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" config={{ globals: { mode } }} storage={createMemoryAdapter()} />);
    await openTrial('A');
    fireEvent.change(vars().getByLabelText('Filter'), { target: { value: 'accent-strong' } });
    fireEvent.change(row(vars(), '--wzl-accent-strong').getByRole('textbox'), { target: { value: '#123456' } });
    await flush();

    fireEvent.click(vars().getByRole('button', { name: 'Save to theme' }));
    await waitFor(() => expect(vars().getByRole('status')).toHaveTextContent('Saved to themes/weasel.json.'));
    const body = JSON.parse(String(calls.find((c) => c.init?.method === 'PUT')?.init?.body));
    const pin = weasel.pins?.['accent-strong'] as unknown as { dark: object; light: object };
    expect(body.definition.pins['accent-strong']).toEqual({ ...pin, light: { ...pin.light, value: '#123456' } });
  });

  it('reports a file changed on disk and keeps the edit', async () => {
    location.hash = '#/x--a';
    stubStore({ status: 409, body: { status: 'conflict', hash: 'h9' } });
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    const font = await editFontBase(String(editedBase));

    fireEvent.click(vars().getByRole('button', { name: 'Save to theme' }));
    await waitFor(() => expect(vars().getByRole('alert')).toHaveTextContent('changed on disk'));
    expect((setsOf(received) as VarsSet[]).some((m) => m.value === null)).toBe(false);
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue(String(editedBase));
    expect(vars().getByRole('button', { name: 'Save to theme' })).toBeInTheDocument();
  });
});

describe('CssVarsPanel history', () => {
  const step = (name: 'Undo' | 'Redo') => vars().getByRole('button', { name });
  /** The gray-50 row, which the panel shows on its own only once filtered to. */
  const gray50 = () => {
    fireEvent.change(vars().getByLabelText('Filter'), { target: { value: 'gray-50' } });
    return row(vars(), '--wzl-gray-50');
  };

  it('takes a token edit back and puts it forward again, telling the frame each time', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    expect(step('Undo')).toBeDisabled();
    const token = gray50();
    fireEvent.change(token.getByRole('textbox'), { target: { value: '#123456' } });
    await flush();
    expect(step('Redo')).toBeDisabled();

    fireEvent.click(step('Undo'));
    await flush();
    expect(setsOf(received).at(-1)).toEqual({ type: 'vars.set', name: '--wzl-gray-50', value: null });
    expect(token.getByRole('textbox')).toHaveValue('#f5f5f6');
    expect(step('Undo')).toBeDisabled();

    fireEvent.click(step('Redo'));
    await flush();
    expect(setsOf(received).at(-1)).toEqual({ type: 'vars.set', name: '--wzl-gray-50', value: '#123456' });
    expect(token.getByRole('textbox')).toHaveValue('#123456');
  });

  it('takes a scale edit back as one step, every token and the base with it', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const { received } = await openTrial('A');
    const font = await editFontBase(String(editedBase));
    const before = setsOf(received).length;

    fireEvent.click(step('Undo'));
    await flush();
    const undone = setsOf(received).slice(before) as VarsSet[];
    expect(undone.map((m) => m.name).sort()).toEqual(fontSteps.map((s) => `--wzl-font-size-${s}`).sort());
    expect(undone.every((m) => m.value === null)).toBe(true);
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue(String(fontBase));
    expect(step('Undo')).toBeDisabled();

    fireEvent.click(step('Redo'));
    await flush();
    expect(font.getByRole('textbox', { name: 'font base' })).toHaveValue(String(editedBase));
  });

  it('steps back on Mod+Z pressed in the panel, and leaves the filter’s own undo alone', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await openTrial('A');
    const token = gray50();
    fireEvent.change(token.getByRole('textbox'), { target: { value: '#123456' } });
    await flush();

    fireEvent.keyDown(vars().getByLabelText('Filter'), { key: 'z', metaKey: true, ctrlKey: true });
    expect(token.getByRole('textbox')).toHaveValue('#123456');
    fireEvent.keyDown(token.getByRole('textbox'), { key: 'z', metaKey: true, ctrlKey: true });
    await flush();
    expect(token.getByRole('textbox')).toHaveValue('#f5f5f6');
  });

  it('keeps the steps with the trial across a reload', async () => {
    location.hash = '#/x--a';
    const storage = createMemoryAdapter();
    const first = renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={storage} />);
    await openTrial('A');
    fireEvent.change(gray50().getByRole('textbox'), { target: { value: '#123456' } });
    // labkit saves a trial's state a moment after it changes.
    await waitFor(() => expect(JSON.stringify(storage.listSync?.(''))).toContain('fg.vars.swap'), { timeout: 5000 });
    first.unmount();

    history.replaceState(null, '', '/');
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={storage} />);
    await openTrial('A');
    const token = gray50();
    expect(token.getByRole('textbox')).toHaveValue('#123456');
    fireEvent.click(step('Undo'));
    await flush();
    expect(token.getByRole('textbox')).toHaveValue('#f5f5f6');
  });

  it('forgets the steps once a scale is saved into the theme', async () => {
    stubStore({ status: 200, body: { hash: 'h2', regenerated: true, problems: [] } });
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await openTrial('A');
    await editFontBase(String(editedBase));
    expect(step('Undo')).toBeEnabled();
    fireEvent.click(vars().getByRole('button', { name: 'Save to theme' }));
    await waitFor(() => expect(vars().getByRole('status')).toHaveTextContent('Saved'));
    expect(step('Undo')).toBeDisabled();
  });
});
