import { createMemoryAdapter, Lab, type LabContribution } from '@weasel-js/labkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IndexEntry } from '../../story/types';
import { installResizeObserver } from '../labHarness';
import { TRIAL_MARKER } from '../TrialMarker';
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

function Harness() {
  const { instruments } = useStoryRegistry(index, { frameUrl: '/frame.html' });
  return (
    <Lab
      instruments={instruments}
      defaultInstrument={slider.id}
      labChrome={tree}
      chrome={TRIAL_MARKER}
      addTrial={false}
      storageKey="tree-test"
      storage={createMemoryAdapter()}
    />
  );
}

const trialsOf = (e: IndexEntry) => screen.queryAllByRole('region', { name: `Trial ${e.title} / ${e.name}` });

async function mount() {
  render(<Harness />);
  return screen.findByRole('tree', { name: 'Stories' });
}

/** Folders open by clicking through, the way a person reaches a story. */
function openFolder(label: string) {
  const folder = screen.getByRole('treeitem', { name: label });
  if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(folder);
}

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  // jsdom has no scrollIntoView; the reveal test installs one.
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe('StoryTree', () => {
  it('heads itself "Stories" and lists top-level folders', async () => {
    const treeEl = await mount();
    expect(screen.getByRole('heading', { name: 'Stories' })).toBeInTheDocument();
    expect(within(treeEl).getByRole('treeitem', { name: 'Kit' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('narrows to matching stories and their folders as the filter is typed', async () => {
    const treeEl = await mount();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter stories' }), { target: { value: 'ghost' } });
    const names = within(treeEl)
      .getAllByRole('treeitem')
      .map((item) => item.textContent);
    expect(names).toEqual(['Kit', 'Button', 'Ghost']);
  });

  it('opens a trial of a story when it is clicked, and sets the route', async () => {
    await mount();
    openFolder('Kit');
    openFolder('Button');
    expect(trialsOf(ghost)).toHaveLength(0);
    fireEvent.click(screen.getByRole('treeitem', { name: 'Ghost' }));
    await waitFor(() => expect(trialsOf(ghost)).toHaveLength(1));
    expect(location.hash).toBe(`#/${ghost.id}`);
    expect(screen.getByRole('treeitem', { name: 'Ghost' })).toHaveAttribute('aria-current', 'true');
  });

  it('reveals the open trial instead of opening another on a second click', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await mount();
    openFolder('Kit');
    openFolder('Slider');
    expect(trialsOf(slider)).toHaveLength(1);
    fireEvent.click(screen.getByRole('treeitem', { name: 'Default' }));
    expect(trialsOf(slider)).toHaveLength(1);
    const trial = trialsOf(slider)[0];
    expect(trial).toHaveClass('fg-flash');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('opens another trial on a cmd- or ctrl-click', async () => {
    await mount();
    openFolder('Kit');
    openFolder('Slider');
    fireEvent.click(screen.getByRole('treeitem', { name: 'Default' }), { metaKey: true });
    await waitFor(() => expect(trialsOf(slider)).toHaveLength(2));
    fireEvent.click(screen.getByRole('treeitem', { name: 'Default' }), { ctrlKey: true });
    await waitFor(() => expect(trialsOf(slider)).toHaveLength(3));
  });

  it('moves focus with the arrow keys, expands and collapses, and activates with Enter', async () => {
    const treeEl = await mount();
    const kit = within(treeEl).getByRole('treeitem', { name: 'Kit' });
    expect(kit).toHaveAttribute('tabindex', '0');
    kit.focus();
    fireEvent.keyDown(kit, { key: 'ArrowRight' });
    expect(kit).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(kit, { key: 'ArrowDown' });
    const button = within(treeEl).getByRole('treeitem', { name: 'Button' });
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('tabindex', '0');
    expect(kit).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const primaryItem = within(treeEl).getByRole('treeitem', { name: 'Primary' });
    expect(primaryItem).toHaveFocus();
    fireEvent.keyDown(primaryItem, { key: 'ArrowLeft' });
    expect(button).toHaveFocus();
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(kit).toHaveFocus();
    fireEvent.keyDown(kit, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    const reopened = within(treeEl).getByRole('treeitem', { name: 'Primary' });
    expect(reopened).toHaveFocus();
    fireEvent.keyDown(reopened, { key: ' ' });
    await waitFor(() => expect(trialsOf(primary)).toHaveLength(1));
  });

  it('names a route that matches no story', async () => {
    history.replaceState(null, '', `/#/no-such--story`);
    await mount();
    expect(document.querySelector('.fg-route-miss')?.textContent).toContain('no-such--story');
  });
});
