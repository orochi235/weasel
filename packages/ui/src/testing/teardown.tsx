import type { ComponentType } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grownSince, installLeakProbe, type LeakProbe } from '@weasel-js/react/testing/leakProbe';
import { domResidue } from '@weasel-js/react/testing/domResidue';
import { storiesOf } from './composeStory';
import { withIcons } from './withIcons';

// The teardown harness the `teardown*.test.tsx` files share. Each mounts what it is given, pokes it, unmounts it and
// flushes, twice: the first pass lets a module install what it keeps for good, and the second must leave no more
// registered, and no more DOM, than it found. The stories are split across files so the suite runs them side by side.

/** Stories left out, by `file#Export`, each with the reason. */
const SKIP: Record<string, string> = {
  './Slider/Slider.stories.tsx#Playground': "calls forge's useArgs, which only forge's frame provides",
};

/** Every story in `modules`, an `import.meta.glob` of story files, as a case named `file#Export`. */
export async function storyCases(modules: Record<string, () => Promise<unknown>>): Promise<[string, ComponentType][]> {
  const cases: [string, ComponentType][] = [];
  for (const [file, load] of Object.entries(modules)) {
    for (const [name, story] of storiesOf((await load()) as Record<string, unknown>)) {
      if (!SKIP[`${file}#${name}`]) cases.push([`${file}#${name}`, story]);
    }
  }
  return cases;
}

const INTERACTIVE = 'button, [role="button"], input, select, textarea, [tabindex], [role="slider"], [role="tab"], canvas, svg';

/** Hover, focus, press and drag the first few things in `root` a person could reach. */
function poke(root: HTMLElement): void {
  const targets = [root.firstElementChild, ...root.querySelectorAll(INTERACTIVE)]
    .filter((el): el is HTMLElement => el instanceof HTMLElement || el instanceof SVGElement)
    .slice(0, 4);
  for (const el of targets) {
    if (!el.isConnected) continue;
    act(() => {
      const at = { clientX: 4, clientY: 4, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
      fireEvent.pointerOver(el, at);
      fireEvent.pointerEnter(el, at);
      fireEvent.mouseOver(el, at);
      fireEvent.pointerMove(el, at);
      el.focus?.();
      fireEvent.keyDown(el, { key: 'ArrowDown' });
      fireEvent.keyUp(el, { key: 'ArrowDown' });
      fireEvent.pointerDown(el, at);
      fireEvent.mouseDown(el, at);
      fireEvent.pointerMove(el, { ...at, clientX: 24, clientY: 18 });
      fireEvent.pointerMove(el.ownerDocument, { ...at, clientX: 40, clientY: 30 });
      fireEvent.pointerUp(el, { ...at, buttons: 0 });
      fireEvent.mouseUp(el, { ...at, buttons: 0 });
      fireEvent.click(el, at);
    });
  }
}

/** A probe installed for the file: before its first test, and put back after its last. */
function fileProbe(): () => LeakProbe {
  let probe: LeakProbe | null = null;
  beforeAll(() => {
    probe = installLeakProbe();
  });
  afterAll(() => probe?.restore());
  return () => {
    if (!probe) throw new Error('fileProbe: read before the file’s tests started');
    return probe;
  };
}

async function cycle(probe: LeakProbe, Story: ComponentType): Promise<void> {
  const host = document.body.appendChild(document.createElement('div'));
  const view = render(<Story />, { container: host, wrapper: withIcons });
  await act(async () => {});
  poke(host);
  await act(async () => {});
  view.unmount();
  host.remove();
  probe.flush();
  await act(async () => {});
  probe.flush();
}

/** One test per case, each failing on whatever its second mount left behind. Hands back the file's probe. */
export function describeTeardown(title: string, cases: [string, ComponentType][], minimum: number): () => LeakProbe {
  const probe = fileProbe();
  describe(title, { timeout: 30_000 }, () => {
    it(`finds at least ${minimum} cases`, () => {
      expect(cases.length).toBeGreaterThanOrEqual(minimum);
    });

    it.each(cases)('%s', async (_, story) => {
      await cycle(probe(), story);
      const before = probe().live();
      const dom = domResidue();
      await cycle(probe(), story);
      expect(grownSince(before, probe().live())).toEqual([]);
      expect(domResidue()).toEqual(dom);
    });
  });
  return probe;
}
