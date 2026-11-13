// One leaf through every surface that edits it: a prefs store's form, a lab's `ControlPanel`, and the theme
// editor's token rows. Each run drives a surface through random Auto toggles, edits, row resets and group resets,
// and checks it against one model built from `prefResetOf` and `prefAutoValue`.
import './labTestSetup';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { auto, ControlPanel, f, resolveConfigSchema } from '@weasel-js/labkit';
import {
  openPrefsSync,
  prefAutoValue,
  prefIsReset,
  prefLeafAt,
  prefResetOf,
  type PrefGroup,
  type PrefLeaf,
} from '@weasel-js/prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { themePrefsSchema } from '@weasel-js/theme/prefs';
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
  shown: () => unknown;
  edit: (shown: unknown) => void;
}

const pinButton = (row: string) => screen.getByRole('button', { name: `Pin ${row}` });
const resetButton = (name: string) => screen.queryByRole('button', { name: `Reset ${name}` });

/** Runs `run` on a fresh mount of `surface` and checks every step against the model. */
function check(surface: Surface, run: readonly Step[]): void {
  cleanup();
  render(surface.render());
  surface.open?.();
  const { leaf } = surface;
  const start = prefResetOf(leaf);
  // What the row reads while auto: the model's, except where only the surface knows the default's form.
  const autoShown = start.auto ? surface.shown() : prefAutoValue(leaf);
  let state = { auto: start.auto, value: leaf.default };
  const shown = (): unknown => (state.auto ? autoShown : state.value);
  const expectState = (): void => {
    expect(pinButton(surface.row).getAttribute('aria-pressed')).toBe(String(!state.auto));
    expect(surface.shown()).toEqual(shown());
    const reset = prefIsReset(leaf, state);
    expect(resetButton(surface.row) === null).toBe(reset);
    expect(resetButton(surface.group)?.getAttribute('aria-disabled') === 'true').toBe(reset);
  };
  expectState();
  for (const step of run) {
    if (step === 'toggle') {
      state = state.auto ? { auto: false, value: shown() } : { auto: true, value: state.value };
      fireEvent.click(pinButton(surface.row));
    } else if (step === 'edit') {
      const before = shown();
      surface.edit(before);
      state = { auto: false, value: surface.shown() };
      expect(state.value).not.toEqual(before);
    } else {
      const button = resetButton(step === 'resetRow' ? surface.row : surface.group);
      if (button !== null && button.getAttribute('aria-disabled') !== 'true') {
        fireEvent.click(button);
        state = { auto: prefResetOf(leaf).auto, value: leaf.default };
      }
    }
    expectState();
  }
}

const grid = (role: 'switch' | 'checkbox') => screen.getByRole(role, { name: 'Grid' }) as HTMLInputElement;

/** The leaf as a prefs schema, starting auto or reading `auto.value` while auto. */
const prefsSchema = (autoSpec: { on: true } | { value: boolean }) =>
  ({
    name: 'Settings',
    children: {
      view: {
        name: 'View',
        resettable: true,
        children: { grid: { kind: 'boolean', name: 'Grid', description: '', default: true, control: 'switch', auto: autoSpec } },
      },
    },
  }) satisfies PrefGroup;

function prefsSurface(autoSpec: { on: true } | { value: boolean }): Surface {
  const schema = prefsSchema(autoSpec);
  function Host() {
    const [store] = useState(() => openPrefsSync(schema, { storage: createMemoryAdapter(new Map()), prefix: 't.' }));
    return <PrefsForm {...usePrefsValues(store).form} layout="list" />;
  }
  return {
    leaf: prefLeafAt(schema, 'view.grid')!,
    render: () => <Host />,
    row: 'Grid',
    group: 'View',
    shown: () => grid('switch').checked,
    edit: () => fireEvent.click(grid('switch')),
  };
}

function labSurface(autoSpec: { on: true } | { value: boolean }): Surface {
  const leafNode = f.boolean(true).switch();
  const resolved = resolveConfigSchema(
    f.schema({ view: f.group({ grid: 'on' in autoSpec ? leafNode.initial(auto) : leafNode.auto() }).resettable() }),
  );
  const view = resolved.group.children.view as PrefGroup;
  if ('value' in autoSpec) view.children.grid = { ...(view.children.grid as PrefLeaf), auto: { value: autoSpec.value } };
  function Host() {
    const [config, setConfig] = useState<Record<string, unknown>>({ view: { grid: true } });
    return (
      <ControlPanel
        schema={resolved}
        config={config}
        setConfig={(path, value) =>
          setConfig((c) => (path === 'view' ? { view: value } : { view: { ...(c.view as object), grid: value } }))
        }
      />
    );
  }
  return {
    leaf: prefLeafAt(resolved.group, 'view.grid')!,
    render: () => <Host />,
    row: 'Grid',
    group: 'View',
    shown: () => grid('switch').checked,
    edit: () => fireEvent.click(grid('switch')),
  };
}

function themeSurface(): Surface {
  const field = () => screen.getByLabelText('50') as HTMLInputElement;
  const gray = Object.values(themePrefsSchema().children).find((g) => g.name === 'Gray') as PrefGroup;
  return {
    leaf: Object.values(gray.children).find((l) => l.name === '50') as PrefLeaf,
    render: () => <ThemePrefs storage={createMemoryAdapter()} />,
    open: () => fireEvent.click(within(screen.getByRole('navigation')).getByText('Gray')),
    row: '50',
    group: 'Gray',
    shown: () => field().value.toLowerCase(),
    edit: (before) => {
      const next = before === '#ff3366' ? '#3366ff' : '#ff3366';
      fireEvent.input(field(), { target: { value: next } });
      fireEvent.change(field(), { target: { value: next } });
    },
  };
}

describe('one leaf, every surface', () => {
  for (const [name, spec] of [['starting auto', { on: true }], ['with an auto value', { value: false }]] as const) {
    it(`behaves alike through a prefs store, ${name}`, () => {
      expect(prefsSurface(spec).leaf.auto).toEqual(spec);
      fc.assert(fc.property(steps, (run) => check(prefsSurface(spec), run)), { numRuns: 12 });
    });

    it(`behaves alike through labkit's ControlPanel, ${name}`, () => {
      fc.assert(fc.property(steps, (run) => check(labSurface(spec), run)), { numRuns: 12 });
    });
  }

  it('behaves alike through the theme editor, whose tokens start auto', () => {
    fc.assert(fc.property(steps, (run) => check(themeSurface(), run)), { numRuns: 5 });
  });
});
