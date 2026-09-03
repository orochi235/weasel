/**
 * The meaning tier: what a mark says, as opposed to where it is. The store
 * already carries `title` / `status` / `tags`; this is the chrome over them,
 * plus the two things a reader needs at a glance — which target a mark is on,
 * and whether it still describes the picture under it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnnotationsContext } from './AnnotationsContext';
import { MarkList } from './MarkList';
import { createAnnotationStore } from './store';
import type { AnnotationMeaning, AnnotationsApi, AnnotationTargetInfo } from './types';

const TARGETS: AnnotationTargetInfo[] = [
  { id: 'flat', content: { w: 200, h: 100 }, positionDependsOn: ['angle'] },
  { id: 'shaded', content: { w: 200, h: 100 } },
];

const MEANING: AnnotationMeaning = {
  statuses: [
    { id: 'open', label: 'Open', color: '#e5484d' },
    { id: 'fixed', label: 'Fixed', color: '#30a46c' },
  ],
};

function mount(store: AnnotationsApi, meaning?: AnnotationMeaning, config: unknown = { angle: 0 }) {
  return render(
    <AnnotationsContext.Provider value={store}>
      <MarkList meaning={meaning} config={config} />
    </AnnotationsContext.Provider>,
  );
}

function seeded() {
  const store = createAnnotationStore({ targets: () => TARGETS });
  store.add(
    {
      target: 'flat',
      kind: 'rect',
      frac: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      title: 'spurious ring',
      status: 'open',
    },
    { angle: 0 },
  );
  store.add({ target: 'shaded', kind: 'line', frac: { x: 0.4, y: 0.4, w: 0.2, h: 0 } }, {});
  return store;
}

describe('<MarkList>', () => {
  it('lists every mark, with the target it is on', () => {
    mount(seeded(), MEANING);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('flat');
    expect(rows[1]?.textContent).toContain('shaded');
  });

  it('writes a status through the store, and re-renders from it', () => {
    const store = seeded();
    mount(store, MEANING);
    const picker = screen.getAllByRole('combobox')[0];
    if (!picker) throw new Error('no status picker');
    fireEvent.change(picker, { target: { value: 'fixed' } });

    expect(store.query({ status: 'fixed' })).toHaveLength(1);
    // The list is not holding its own copy: the value it shows came back out
    // of the store, which is what makes a mark drawn on the canvas appear here.
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('fixed');
  });

  it('renames a mark through the store', () => {
    const store = seeded();
    mount(store, MEANING);
    const field = screen.getAllByRole('textbox')[0];
    if (!field) throw new Error('no title field');
    fireEvent.change(field, { target: { value: 'missing edge' } });
    expect(store.query({ where: (a) => a.title === 'missing edge' })).toHaveLength(1);
  });

  it("marks a row stale when its target's declared config moved", () => {
    const store = seeded();
    // `flat` snapshotted angle 0 and declares it; `shaded` declares nothing
    // and can never go stale.
    mount(store, MEANING, { angle: 30 });
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('stale');
    expect(rows[1]?.textContent).not.toContain('stale');
  });

  it('drops a mark on request', () => {
    const store = seeded();
    mount(store, MEANING);
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0] as HTMLElement);
    expect(store.query()).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('still lists marks for an instrument that declared no vocabulary', () => {
    // No `meaning` is "this host owns what a mark means", not "hide the list".
    mount(seeded());
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('says so when there are none', () => {
    mount(createAnnotationStore({ targets: () => TARGETS }), MEANING);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText(/no marks/i)).toBeTruthy();
  });
});
