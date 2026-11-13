// One leaf through every surface that edits it: a prefs store's form, a lab's `ControlPanel`, and the theme
// editor's rows. Each run drives a surface through random Auto toggles, edits, row resets and group resets, and
// checks it against one model: a leaf is auto only where its schema declares `auto`, reads only what its owner
// computes while it is (`prefAutoValue`), and a reset puts it back as `prefResetOf` says.
import './labTestSetup';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { auto, ControlPanel, f, isAuto, resolveAutoConfig, resolveConfigSchema } from '@weasel-js/labkit';
import {
  openPrefsSync,
  prefAutoValue,
  prefCanAuto,
  prefIsReset,
  prefLeafAt,
  prefResetOf,
  type PrefAuto,
  type PrefGroup,
  type PrefLeaf,
  type PrefsStore,
} from '@weasel-js/prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { themeAxisPath, themePrefsSchema } from '@weasel-js/theme/prefs';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import fc from 'fast-check';
import { type ReactElement, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemePrefs } from './ThemePrefs';

afterEach(cleanup);

type Step = 'toggle' | 'edit' | 'resetRow' | 'resetGroup';
const steps = fc.array(fc.constantFrom<Step>('toggle', 'edit', 'resetRow', 'resetGroup'), { maxLength: 6 });

/** How a test reads and drives one surface's row of the leaf, and its group's heading. */
interface Surface {
  leaf: PrefLeaf;
  render: () => ReactElement;
  /** Reach the row, once mounted. */
  open?: () => void;
  row: string;
  group: string;
  /** What the row's control draws. */
  shown: () => unknown;
  /** What the leaf reads: what a store's `get`, or an instrument, is handed. */
  read: () => unknown;
  /** What the leaf's owner computes for it while auto, where it computes anything. */
  computed?: () => unknown;
  edit: (shown: unknown) => void;
}

const pinButton = (row: string) => screen.queryByRole('button', { name: `Pin ${row}` });
const resetButton = (name: string) => screen.queryByRole('button', { name: `Reset ${name}` });

/** Runs `run` on a fresh mount of `surface` and checks every step against the model. */
function check(surface: Surface, run: readonly Step[]): void {
  cleanup();
  render(surface.render());
  surface.open?.();
  const { leaf } = surface;
  const canAuto = prefCanAuto(leaf);
  const start = prefResetOf(leaf);
  let state = { auto: start.auto, value: leaf.default };
  // While auto the leaf reads what its owner computes, else its `auto.value`, else nothing: never its default.
  const autoRead = (): unknown => prefAutoValue(leaf, surface.computed?.());
  const read = (): unknown => (state.auto ? autoRead() : state.value);
  // The control has to draw something, and with nothing computed draws what a field holding nothing draws.
  const shown = (): unknown => (state.auto ? (autoRead() ?? leaf.default) : state.value);
  const expectState = (): void => {
    if (canAuto) expect(pinButton(surface.row)?.getAttribute('aria-pressed')).toBe(String(!state.auto));
    else expect(pinButton(surface.row)).toBeNull();
    expect(surface.shown()).toEqual(shown());
    expect(surface.read()).toEqual(read());
    const reset = prefIsReset(leaf, state);
    expect(resetButton(surface.row) === null).toBe(reset);
    expect(resetButton(surface.group)?.getAttribute('aria-disabled') === 'true').toBe(reset);
  };
  expectState();
  for (const step of run) {
    if (step === 'toggle') {
      if (!canAuto) continue;
      state = state.auto ? { auto: false, value: shown() } : { auto: true, value: state.value };
      fireEvent.click(pinButton(surface.row)!);
    } else if (step === 'edit') {
      const before = shown();
      surface.edit(before);
      state = { auto: false, value: surface.shown() };
      expect(state.value).not.toEqual(before);
    } else {
      const button = resetButton(step === 'resetRow' ? surface.row : surface.group);
      if (button !== null && button.getAttribute('aria-disabled') !== 'true') {
        fireEvent.click(button);
        state = { auto: start.auto, value: leaf.default };
      }
    }
    expectState();
  }
}

const grid = () => screen.getByRole('switch', { name: 'Grid' }) as HTMLInputElement;

/** The leaf as a prefs schema: `auto` as given, or none. */
const prefsSchema = (autoSpec: PrefAuto | undefined) =>
  ({
    name: 'Settings',
    children: {
      view: {
        name: 'View',
        resettable: true,
        children: {
          grid: {
            kind: 'boolean', name: 'Grid', description: '', default: true, control: 'switch',
            ...(autoSpec === undefined ? {} : { auto: autoSpec }),
          },
        },
      },
    },
  }) as PrefGroup;

function prefsSurface(autoSpec: PrefAuto | undefined, seeded = new Map<string, unknown>()): Surface & { store: PrefsStore<PrefGroup> } {
  const schema = prefsSchema(autoSpec);
  const store = openPrefsSync(schema, { storage: createMemoryAdapter(seeded), prefix: 't.' });
  function Host() {
    return <PrefsForm {...usePrefsValues(store).form} layout="list" />;
  }
  return {
    store,
    leaf: prefLeafAt(schema, 'view.grid')!,
    render: () => <Host />,
    row: 'Grid',
    group: 'View',
    shown: () => grid().checked,
    read: () => store.get('view.grid'),
    edit: () => fireEvent.click(grid()),
  };
}

type LabSpec = 'none' | 'resolver' | 'starts' | { value: boolean };

/** The leaf as a lab schema: no auto, `.auto(fn)` computing false, `.initial(auto)` with nothing computing it,
 *  or an `auto.value`. */
function labSurface(spec: LabSpec): Surface {
  const plain = f.boolean(true).switch();
  const node = spec === 'resolver' ? plain.auto(() => false) : spec === 'starts' ? plain.initial(auto) : plain;
  const resolved = resolveConfigSchema(f.schema({ view: f.group({ grid: node }).resettable() }));
  const view = resolved.group.children.view as PrefGroup;
  if (typeof spec === 'object') view.children.grid = { ...(view.children.grid as PrefLeaf), auto: { value: spec.value } };
  const leaf = prefLeafAt(resolved.group, 'view.grid')!;
  const now = { config: { view: { grid: true } } as Record<string, unknown>, auto: new Set<string>(prefResetOf(leaf).auto ? ['view.grid'] : []) };
  function Host() {
    const [held, setHeld] = useState(now);
    now.config = held.config;
    now.auto = held.auto;
    // One leaf: a write at the group or the leaf holds its value, or the sentinel that unpins it.
    const write = (path: string, value: unknown): void => {
      const next = path === 'view' ? (value as { grid: unknown }).grid : value;
      setHeld((h) => {
        const unpinned = new Set(h.auto);
        if (isAuto(next)) return { config: h.config, auto: unpinned.add('view.grid') };
        unpinned.delete('view.grid');
        return { config: { view: { grid: next } }, auto: unpinned };
      });
    };
    return <ControlPanel schema={resolved} config={held.config} auto={held.auto} setConfig={write} />;
  }
  return {
    leaf,
    render: () => <Host />,
    row: 'Grid',
    group: 'View',
    shown: () => grid().checked,
    read: () => (resolveAutoConfig(resolved, now.config, now.auto).view as { grid?: unknown } | undefined)?.grid,
    ...(spec === 'resolver' ? { computed: () => false } : {}),
    edit: () => fireEvent.click(grid()),
  };
}

function themeSurface(): Surface {
  const field = () => screen.getByLabelText('50') as HTMLInputElement;
  const gray = Object.values(themePrefsSchema().children).find((g) => g.name === 'Gray') as PrefGroup;
  let theme: unknown;
  return {
    leaf: Object.values(gray.children).find((l) => l.name === '50') as PrefLeaf,
    render: () => <ThemePrefs storage={createMemoryAdapter()} />,
    open: () => {
      fireEvent.click(within(screen.getByRole('navigation')).getByText('Gray'));
      theme = field().value.toLowerCase();
    },
    row: '50',
    group: 'Gray',
    shown: () => field().value.toLowerCase(),
    // The theme computes a token while it follows it; the row is what reads it.
    read: () => field().value.toLowerCase(),
    computed: () => theme,
    edit: (before) => {
      const next = before === '#ff3366' ? '#3366ff' : '#ff3366';
      fireEvent.input(field(), { target: { value: next } });
      fireEvent.change(field(), { target: { value: next } });
    },
  };
}

describe('one leaf, every surface', () => {
  const PREFS: readonly [string, PrefAuto | undefined][] = [
    ['that declares no auto', undefined],
    ['that opts in and starts auto with nothing to read', { on: true }],
    ['that opts in with an auto value', { value: false }],
    ['that starts auto at an auto value', { on: true, value: false }],
  ];
  for (const [name, spec] of PREFS) {
    it(`behaves alike through a prefs store, for a leaf ${name}`, () => {
      expect(prefsSurface(spec).leaf.auto).toEqual(spec);
      fc.assert(fc.property(steps, (run) => check(prefsSurface(spec), run)), { numRuns: 12 });
    });
  }

  it('repairs a stored auto mark for a leaf that does not opt in to nothing stored, on every run', () => {
    const marked = () => new Map<string, unknown>([['t.view.grid', { $at: 0, $auto: true }]]);
    const surface = prefsSurface(undefined, marked());
    expect(surface.store.isAuto('view.grid')).toBe(false);
    expect(surface.store.isSet('view.grid')).toBe(false);
    fc.assert(fc.property(steps, (run) => check(prefsSurface(undefined, marked()), run)), { numRuns: 12 });
  });

  const LABS: readonly [string, LabSpec][] = [
    ['that declares no auto', 'none'],
    ['whose resolver computes it', 'resolver'],
    ['that starts auto with nothing computing it', 'starts'],
    ['with an auto value', { value: false }],
  ];
  for (const [name, spec] of LABS) {
    it(`behaves alike through labkit's ControlPanel, for a leaf ${name}`, () => {
      fc.assert(fc.property(steps, (run) => check(labSurface(spec), run)), { numRuns: 12 });
    });
  }

  it('behaves alike through the theme editor, whose tokens start auto at what the theme computes', () => {
    fc.assert(fc.property(steps, (run) => check(themeSurface(), run)), { numRuns: 5 });
  });

  it("offers no Auto on the theme editor's axes, which declare none, and repairs a stored mark for one", () => {
    const axis = themeAxisPath('mode');
    const storage = createMemoryAdapter(new Map([[`theme-prefs.${axis}`, { $at: 0, $auto: true }]]));
    render(<ThemePrefs storage={storage} />);
    fireEvent.click(within(screen.getByRole('navigation')).getByText('Axes'));
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(pinButton('Mode')).toBeNull();
    expect(resetButton('Mode')).toBeNull();
  });
});
