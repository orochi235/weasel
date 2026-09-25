import { createMemoryAdapter, Lab, type LabContribution, type StorageAdapter } from '@weasel-js/labkit';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexEntries, indexId } from '../../story/indexPages';
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
const withIndexPages = [...index, ...indexEntries(index)];
const buttonIndex = withIndexPages.find((e) => e.id === indexId('Kit/Button')) as IndexEntry;

const tree: LabContribution[] = [
  { id: 'fg-stories', region: 'sidebar', render: (ctx) => <StoryTree ctx={ctx} index={index} /> },
];

function Harness({ storage }: { storage: StorageAdapter }) {
  const { instruments } = useStoryRegistry(withIndexPages, { frameUrl: '/frame.html' });
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

const trialsOf = (e: IndexEntry) => screen.queryAllByRole('region', { name: `Trial ${e.title} / ${e.name}` });
const allTrials = () => screen.queryAllByRole('region', { name: /^Trial / });

/** Mounts the lab and switches the sidebar to the folder tree, which these tests exercise. */
async function mount(storage: StorageAdapter = createMemoryAdapter()) {
  const view = render(<Harness storage={storage} />);
  const treeEl = await screen.findByRole('tree', { name: 'Stories' });
  fireEvent.click(screen.getByRole('radio', { name: 'Tree' }));
  return { treeEl, view };
}

/** The fold mark on a folder's own row, which folds it without opening its index page. */
const foldOf = (folder: HTMLElement) => folder.querySelector(':scope > .fg-tree__folder > .fg-tree__fold') as HTMLElement;

/** Folders open by their fold marks, so no index page loads on the way to a story. */
function openFolder(label: string) {
  const folder = screen.getByRole('treeitem', { name: label });
  if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(foldOf(folder));
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
  it('lists components until another view is chosen', async () => {
    render(<Harness storage={createMemoryAdapter()} />);
    await screen.findByRole('tree', { name: 'Stories' });
    expect(screen.getByRole('radio', { name: 'Components' })).toHaveAttribute('aria-checked', 'true');
  });

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

  it('opens a component folder and runs its index page when its row is clicked', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { treeEl } = await mount();
    openFolder('Kit');
    const button = item(treeEl, 'Button');
    fireEvent.click(within(button).getByText('Button'));
    await waitFor(() => expect(trialsOf(buttonIndex)).toHaveLength(1));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(allTrials()).toHaveLength(1);
    expect(location.hash).toBe(`#/${encodeURIComponent(buttonIndex.id)}`);
    expect(button).toHaveAttribute('aria-current', 'true');
    expect(within(within(button).getByRole('group')).getAllByRole('treeitem').map((el) => el.textContent)).toEqual([
      'Primary',
      'Ghost',
    ]);
    expect(document.querySelector('.fg-route-miss')).toBeNull();

    fireEvent.click(within(button).getByText('Button'));
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes a component its selection opened once the selection moves on, and keeps one opened by hand', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { treeEl } = await mount();
    openFolder('Kit');
    fireEvent.click(within(item(treeEl, 'Button')).getByText('Button'));
    await waitFor(() => expect(item(treeEl, 'Button')).toHaveAttribute('aria-expanded', 'true'));
    fireEvent.click(within(item(treeEl, 'Slider')).getByText('Slider'));
    await waitFor(() => expect(item(treeEl, 'Slider')).toHaveAttribute('aria-expanded', 'true'));
    expect(item(treeEl, 'Button')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(foldOf(item(treeEl, 'Button')));
    fireEvent.click(within(item(treeEl, 'Button')).getByText('Button'));
    await waitFor(() => expect(location.hash).toBe(`#/${encodeURIComponent(buttonIndex.id)}`));
    expect(item(treeEl, 'Slider')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(item(treeEl, 'Slider')).getByText('Slider'));
    await waitFor(() => expect(item(treeEl, 'Slider')).toHaveAttribute('aria-expanded', 'true'));
    expect(item(treeEl, 'Button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('lets a selection open a component that was closed by hand', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { treeEl } = await mount();
    openFolder('Kit');
    fireEvent.click(foldOf(item(treeEl, 'Button')));
    fireEvent.click(foldOf(item(treeEl, 'Button')));
    expect(item(treeEl, 'Button')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(item(treeEl, 'Button')).getByText('Button'));
    await waitFor(() => expect(item(treeEl, 'Button')).toHaveAttribute('aria-expanded', 'true'));
  });

  it('folds a component with its fold mark alone, running nothing', async () => {
    const { treeEl } = await mount();
    openFolder('Kit');
    const button = item(treeEl, 'Button');
    fireEvent.click(foldOf(button));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(foldOf(button));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(trialsOf(buttonIndex)).toHaveLength(0);
    expect(trialsOf(slider)).toHaveLength(1);
  });

  it('toggles a folder no component owns when its row is clicked', async () => {
    const { treeEl } = await mount();
    const kit = item(treeEl, 'Kit');
    fireEvent.click(within(kit).getByText('Kit'));
    expect(kit).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(kit).getByText('Kit'));
    expect(kit).toHaveAttribute('aria-expanded', 'false');
  });

  it('makes a one-story component a folder in the components view', async () => {
    const view = render(<Harness storage={createMemoryAdapter()} />);
    const treeEl = await screen.findByRole('tree', { name: 'Stories' });
    const sliderRow = item(treeEl, 'Slider');
    expect(sliderRow).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(foldOf(sliderRow));
    const group = within(item(treeEl, 'Slider')).getByRole('group');
    expect(within(group).getAllByRole('treeitem').map((el) => el.textContent)).toEqual(['Default']);
    view.unmount();
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

    it('opens a component and runs its index page with Enter', async () => {
      const { treeEl } = await mount();
      openFolder('Kit');
      const button = item(treeEl, 'Button');
      act(() => button.focus());
      fireEvent.keyDown(button, { key: 'Enter' });
      await waitFor(() => expect(trialsOf(buttonIndex)).toHaveLength(1));
      expect(button).toHaveAttribute('aria-expanded', 'true');
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

  it('opens the routed component in the components view, and leaves the others shut', async () => {
    history.replaceState(null, '', `/#/${ghost.id}`);
    render(<Harness storage={createMemoryAdapter()} />);
    const treeEl = await screen.findByRole('tree', { name: 'Stories' });
    expect(item(treeEl, 'Button')).toHaveAttribute('aria-expanded', 'true');
    expect(item(treeEl, 'Slider')).toHaveAttribute('aria-expanded', 'false');
  });

  it('names a route that matches no story', async () => {
    history.replaceState(null, '', `/#/no-such--story`);
    await mount();
    expect(document.querySelector('.fg-route-miss')?.textContent).toContain('no-such--story');
  });
});
