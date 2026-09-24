import { breadcrumb } from '../breadcrumb';
import { createMemoryAdapter, Lab, type LabContribution, type StorageAdapter } from '@weasel-js/labkit';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IndexEntry } from '../../story/types';
import { installResizeObserver } from '../labHarness';
import { useStoryRegistry } from '../useStoryRegistry';
import { StoryTree } from './StoryTree';

installResizeObserver();

const entry = (title: string, name: string): IndexEntry => ({
  id: `${title.toLowerCase().replaceAll('/', '-')}--${name.toLowerCase()}`,
  title,
  name,
  exportName: name,
  file: '/x.stories.tsx',
});

const primary = entry('Kit/Button', 'Primary');
const ghost = entry('Kit/Button', 'Ghost');
const slider = entry('Kit/Slider', 'Default');
const index = [primary, ghost, slider];

const tree: LabContribution[] = [
  { id: 'fg-stories', region: 'sidebar', render: (ctx) => <StoryTree ctx={ctx} index={index} /> },
];

function Harness({ storage }: { storage: StorageAdapter }) {
  const { instruments } = useStoryRegistry(index, { frameUrl: '/frame.html' });
  return (
    <Lab
      instruments={instruments}
      defaultInstrument={slider.id}
      labChrome={tree}
      addTrial={false}
      storageKey="tree-test"
      storage={storage}
    />
  );
}

const trialsOf = (e: IndexEntry) => screen.queryAllByRole('region', { name: `Trial ${breadcrumb(e.title, e.name)}` });
const allTrials = () => screen.queryAllByRole('region', { name: /^Trial / });

async function mount(storage: StorageAdapter = createMemoryAdapter()) {
  const view = render(<Harness storage={storage} />);
  const treeEl = await screen.findByRole('tree', { name: 'Stories' });
  return { treeEl, view };
}

/** Folders open by clicking through, the way a person reaches a story. */
function openFolder(label: string) {
  const folder = screen.getByRole('treeitem', { name: label });
  if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(within(folder).getByText(label));
}

const item = (scope: HTMLElement, name: string) => within(scope).getByRole('treeitem', { name });

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.useRealTimers();
  vi.restoreAllMocks();
  // jsdom has no scrollIntoView; the reveal tests install one.
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe('StoryTree', () => {
  it('heads itself "Stories" and lists top-level folders', async () => {
    const { treeEl } = await mount();
    expect(screen.getByRole('heading', { name: 'Stories' })).toBeInTheDocument();
    expect(item(treeEl, 'Kit')).toHaveAttribute('aria-expanded', 'false');
  });

  it('nests each open folder’s group inside the folder’s own item', async () => {
    const { treeEl } = await mount();
    openFolder('Kit');
    const kit = item(treeEl, 'Kit');
    const groups = within(treeEl).getAllByRole('group');
    expect(groups).toHaveLength(1);
    expect(kit).toContainElement(groups[0] as HTMLElement);
    expect(within(groups[0] as HTMLElement).getByRole('treeitem', { name: 'Button' })).toBeInTheDocument();
  });

  it('narrows to matching stories and their folders as the filter is typed', async () => {
    const { treeEl } = await mount();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter stories' }), { target: { value: 'ghost' } });
    const names = within(treeEl)
      .getAllByRole('treeitem')
      .map((el) => el.getAttribute('aria-level'));
    expect(names).toEqual(['1', '2', '3']);
    expect(item(treeEl, 'Ghost')).toBeInTheDocument();
  });

  it('leaves fold state alone when a folder is clicked or toggled while the filter forces it open', async () => {
    const { treeEl } = await mount();
    openFolder('Kit');
    const filter = screen.getByRole('searchbox', { name: 'Filter stories' });
    fireEvent.change(filter, { target: { value: 'ghost' } });
    fireEvent.click(within(item(treeEl, 'Kit')).getAllByText('Kit')[0] as HTMLElement);
    fireEvent.change(filter, { target: { value: '' } });
    expect(item(treeEl, 'Kit')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.change(filter, { target: { value: 'ghost' } });
    act(() => item(treeEl, 'Kit').focus());
    fireEvent.keyDown(item(treeEl, 'Kit'), { key: 'Enter' });
    fireEvent.change(filter, { target: { value: '' } });
    expect(item(treeEl, 'Kit')).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a folder open across a remount of the lab', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(createMemoryAdapter(backing));
    openFolder('Kit');
    expect(item(first.treeEl, 'Kit')).toHaveAttribute('aria-expanded', 'true');
    first.view.unmount();
    await waitFor(() => expect([...backing.keys()].some((key) => key.includes('fg-tree-open'))).toBe(true));
    const second = await mount(createMemoryAdapter(backing));
    expect(item(second.treeEl, 'Kit')).toHaveAttribute('aria-expanded', 'true');
  });

  it('runs a clicked story in the focused trial, and sets the route', async () => {
    await mount();
    openFolder('Kit');
    openFolder('Button');
    fireEvent.click(screen.getByRole('treeitem', { name: 'Ghost' }));
    await waitFor(() => expect(trialsOf(ghost)).toHaveLength(1));
    expect(trialsOf(slider)).toHaveLength(0);
    expect(allTrials()).toHaveLength(1);
    expect(location.hash).toBe(`#/${ghost.id}`);
    expect(screen.getByRole('treeitem', { name: 'Ghost' })).toHaveAttribute('aria-current', 'true');
  });

  it('reveals the focused trial when it already runs the clicked story', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await mount();
    openFolder('Kit');
    openFolder('Slider');
    expect(trialsOf(slider)).toHaveLength(1);
    fireEvent.click(screen.getByRole('treeitem', { name: 'Default' }));
    expect(trialsOf(slider)).toHaveLength(1);
    expect(trialsOf(slider)[0]).toHaveClass('fg-flash');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('stops flashing a revealed trial after 600 ms', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    await mount();
    openFolder('Kit');
    openFolder('Slider');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('treeitem', { name: 'Default' }));
    const trial = trialsOf(slider)[0] as HTMLElement;
    act(() => vi.advanceTimersByTime(599));
    expect(trial).toHaveClass('fg-flash');
    act(() => vi.advanceTimersByTime(1));
    expect(trial).not.toHaveClass('fg-flash');
  });

  it('opens another trial on a shift-click, which later clicks then run in', async () => {
    await mount();
    openFolder('Kit');
    openFolder('Slider');
    openFolder('Button');
    fireEvent.click(screen.getByRole('treeitem', { name: 'Default' }), { shiftKey: true });
    await waitFor(() => expect(trialsOf(slider)).toHaveLength(2));
    fireEvent.click(screen.getByRole('treeitem', { name: 'Ghost' }));
    await waitFor(() => expect(trialsOf(ghost)).toHaveLength(1));
    expect(trialsOf(slider)).toHaveLength(1);
  });

  it('runs a clicked story in the trial last pointed at', async () => {
    await mount();
    openFolder('Kit');
    openFolder('Button');
    fireEvent.click(screen.getByRole('treeitem', { name: 'Ghost' }), { shiftKey: true });
    await waitFor(() => expect(trialsOf(ghost)).toHaveLength(1));
    fireEvent.pointerDown(trialsOf(slider)[0] as HTMLElement);
    fireEvent.click(screen.getByRole('treeitem', { name: 'Primary' }));
    await waitFor(() => expect(trialsOf(primary)).toHaveLength(1));
    expect(trialsOf(slider)).toHaveLength(0);
    expect(trialsOf(ghost)).toHaveLength(1);
  });

  it('leaves a cmd- or ctrl-click to the browser', async () => {
    await mount();
    openFolder('Kit');
    openFolder('Button');
    expect(fireEvent.click(screen.getByRole('treeitem', { name: 'Ghost' }), { metaKey: true })).toBe(true);
    expect(fireEvent.click(screen.getByRole('treeitem', { name: 'Ghost' }), { ctrlKey: true })).toBe(true);
    expect(trialsOf(ghost)).toHaveLength(0);
  });

  describe('keyboard', () => {
    const tabStops = (treeEl: HTMLElement) => treeEl.querySelectorAll('[tabindex="0"]');

    it('keeps exactly one item in the tab order as focus moves', async () => {
      const { treeEl } = await mount();
      expect(tabStops(treeEl)).toHaveLength(1);
      const kit = item(treeEl, 'Kit');
      expect(kit).toHaveAttribute('tabindex', '0');
      act(() => kit.focus());
      fireEvent.keyDown(kit, { key: 'ArrowRight' });
      fireEvent.keyDown(kit, { key: 'ArrowDown' });
      const button = item(treeEl, 'Button');
      expect(button).toHaveAttribute('tabindex', '0');
      expect(kit).toHaveAttribute('tabindex', '-1');
      expect(tabStops(treeEl)).toHaveLength(1);
    });

    it('moves down and up through visible items, and to the ends with Home and End', async () => {
      const { treeEl } = await mount();
      const kit = item(treeEl, 'Kit');
      act(() => kit.focus());
      fireEvent.keyDown(kit, { key: 'ArrowRight' });
      fireEvent.keyDown(kit, { key: 'ArrowDown' });
      const button = item(treeEl, 'Button');
      expect(button).toHaveFocus();
      fireEvent.keyDown(button, { key: 'ArrowUp' });
      expect(kit).toHaveFocus();
      fireEvent.keyDown(kit, { key: 'End' });
      expect(item(treeEl, 'Slider')).toHaveFocus();
      fireEvent.keyDown(item(treeEl, 'Slider'), { key: 'Home' });
      expect(kit).toHaveFocus();
    });

    it('expands a folder with ArrowRight, then moves into it', async () => {
      const { treeEl } = await mount();
      const kit = item(treeEl, 'Kit');
      act(() => kit.focus());
      fireEvent.keyDown(kit, { key: 'ArrowRight' });
      expect(kit).toHaveAttribute('aria-expanded', 'true');
      fireEvent.keyDown(kit, { key: 'ArrowRight' });
      expect(item(treeEl, 'Button')).toHaveFocus();
    });

    it('collapses an open folder with ArrowLeft, and moves to the parent from a child', async () => {
      const { treeEl } = await mount();
      openFolder('Kit');
      openFolder('Button');
      const primaryItem = item(treeEl, 'Primary');
      act(() => primaryItem.focus());
      fireEvent.keyDown(primaryItem, { key: 'ArrowLeft' });
      const button = item(treeEl, 'Button');
      expect(button).toHaveFocus();
      fireEvent.keyDown(button, { key: 'ArrowLeft' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggles a folder with Enter', async () => {
      const { treeEl } = await mount();
      const kit = item(treeEl, 'Kit');
      act(() => kit.focus());
      fireEvent.keyDown(kit, { key: 'Enter' });
      expect(kit).toHaveAttribute('aria-expanded', 'true');
      fireEvent.keyDown(kit, { key: 'Enter' });
      expect(kit).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens a story’s trial with Space', async () => {
      const { treeEl } = await mount();
      openFolder('Kit');
      openFolder('Button');
      const primaryItem = item(treeEl, 'Primary');
      act(() => primaryItem.focus());
      fireEvent.keyDown(primaryItem, { key: ' ' });
      await waitFor(() => expect(trialsOf(primary)).toHaveLength(1));
    });

    it('opens another trial with Shift+Enter', async () => {
      const { treeEl } = await mount();
      openFolder('Kit');
      openFolder('Slider');
      const defaultItem = item(treeEl, 'Default');
      act(() => defaultItem.focus());
      fireEvent.keyDown(defaultItem, { key: 'Enter', shiftKey: true });
      await waitFor(() => expect(trialsOf(slider)).toHaveLength(2));
    });
  });

  it('names a route that matches no story', async () => {
    history.replaceState(null, '', `/#/no-such--story`);
    await mount();
    expect(document.querySelector('.fg-route-miss')?.textContent).toContain('no-such--story');
  });
});
