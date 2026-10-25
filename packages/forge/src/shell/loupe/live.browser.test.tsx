import '../../../../../apps/forge/labkitStyles';
import '../shell.css';
import './live.browser.test.css';
import { createMemoryAdapter, Lab, TrialIdContext } from '@weasel-js/labkit';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { Callout } from '@weasel-js/ui/components/Callout';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { FrameSetup } from '../../frame/FrameController';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import type { IndexEntry } from '../../story/types';
import { createAnswerBook } from '../answers';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { storyInstrument } from '../storyInstrument';
import { StoryTrial } from '../StoryTrial';
import { Workshop } from '../Workshop';
import { resolveComparison } from './conditions';
import { createLiveLenses, LiveLensesContext } from './liveLenses';
import { createLiveSource } from './liveSource';
import { topmostIn } from './tokenChain';

// Where a copy lands, what a hit test inside a lens finds, and where a popover is placed are layout, scrolling and
// hit-testing: a real browser's.

const setup: FrameSetup = {
  applyGlobals: (globals, target) => {
    target.root.dataset.wzlMode = String(globals.mode ?? 'light');
  },
};

beforeEach(async () => {
  await page.viewport(1100, 760);
});

afterEach(() => {
  cleanup();
  history.replaceState(null, '', location.pathname);
});

const tall: IndexEntry = { id: 'l--tall', title: 'L', name: 'Tall', exportName: 'Tall', file: '/l.stories.tsx' };
const tallModule = {
  default: meta({ title: 'L' }),
  Tall: story({
    layout: 'fullscreen',
    render: () => (
      <div className="fg-live-test-tall">
        <div className="fg-live-test-decoy" />
        <div className="fg-live-test-marker" />
      </div>
    ),
  }),
};

const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function press(target: Element, init: KeyboardEventInit) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, ...init }));
}

it('shows the patch under the reticle in a story scrolled inside its host', async () => {
  history.replaceState(null, '', `${location.pathname}#/l--tall`);
  const { container } = renderWithIcons(
    <div className="fg-live-test-workshop">
    <Workshop
      index={[tall]}
      frameUrl="/frame.html"
      importers={{ '/l.stories.tsx': () => Promise.resolve(tallModule as unknown as Record<string, unknown>) }}
      setup={setup}
      storage={createMemoryAdapter()}
    />
    </div>,
  );
  const host = await waitFor(() => {
    const el = container.querySelector<HTMLElement>('[data-fg-host]:not([data-fg-copy])');
    if (!el?.querySelector('.fg-live-test-marker') || el.hasAttribute('data-pending')) throw new Error('no story yet');
    return el;
  });
  const scroller = host.querySelector<HTMLElement>(':scope > .fg-story__scroll')!;
  scroller.scrollTop = 300;
  await waitFor(() => expect(scroller.scrollTop).toBe(300));
  const marker = host.querySelector('.fg-live-test-marker')!;

  // A lens added with the pointer over the marker puts its reticle there.
  await userEvent.hover(marker);
  const body = container.querySelector('.lk-lab__body')!;
  press(body, { code: 'KeyL', key: 'l', altKey: true });
  expect(await screen.findByRole('status', { name: 'Loupe' })).toBeVisible();
  press(body, { code: 'KeyL', key: 'l' });

  const copyMarker = await waitFor(() => {
    const el = document.querySelector('.fg-lens-copy [data-fg-copy]:not([data-pending]) .fg-live-test-marker');
    if (!el) throw new Error('no copy yet');
    return el;
  });
  const layer = document.querySelector<HTMLElement>('.lk-lens-layer')!;
  const at = center(document.querySelector('.lk-lens-interior .lk-lens-cell')!);
  // The readouts' own probe, which stands the copy up for one look. Outside `waitFor`, which would re-run on the
  // probe's own mutations.
  expect(topmostIn(document.querySelector('.fg-lens-copy')!, at)).toBe(copyMarker);
  expect(layer.hasAttribute('data-probe')).toBe(false);
});

function Menu() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={trigger} type="button" className="fg-live-test-open" onClick={() => setOpen(true)}>
        Open
      </button>
      <Callout triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom" showCloseButton={false} title="Menu">
        Item
      </Callout>
    </>
  );
}

const [menu] = loadNativeModule({ default: meta({ title: 'M' }), Menu: story({ layout: 'padded', render: () => <Menu /> }) }, 'M');

/** A dark Callout outside any story: what the copy's popover should match. */
function Reference() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setRoot} data-wzl-mode="dark" className="fg-live-test-reference">
      {root ? (
        <Callout portalContainer={root} anchorRect={{ x: 0, y: 0, width: 1, height: 1 }} isOpen placement="bottom" showCloseButton={false} title="Reference">
          Item
        </Callout>
      ) : null}
    </div>
  );
}

it('clips a popover opened in the copy to the lens, and paints it in the copy’s mode', async () => {
  const lenses = createLiveLenses();
  const { container } = renderWithIcons(
    <LiveLensesContext.Provider value={lenses}>
      <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
        <TrialIdContext.Provider value="t1">
          <div className="fg-live-test-host">
            <StoryTrial story={menu!} setup={setup} ctx={{ config: {}, state: null, setConfig: () => {}, setState: () => {} }} />
          </div>
        </TrialIdContext.Provider>
      </StoryGlobalsContext.Provider>
      <div className="fg-live-test-slot" />
      <Reference />
    </LiveLensesContext.Provider>,
  );
  const host = container.querySelector<HTMLElement>('[data-fg-host="t1"]')!;
  const open = await waitFor(() => {
    const el = host.querySelector('.fg-live-test-open');
    if (!el || host.hasAttribute('data-pending')) throw new Error('no story yet');
    return el;
  });
  const slot = container.querySelector<HTMLElement>('.fg-live-test-slot')!;
  const source = createLiveSource(lenses, resolveComparison, () => ({
    base: { mode: 'light' },
    ctx: { declarations: {}, modeGlobal: 'mode', prefersDark: false, labMode: 'light' },
  }));
  source.attach(slot, {
    lensId: 'a',
    reticle: center(open),
    factor: 2,
    size: { width: 200, height: 200 },
    conditions: { kind: 'custom', globals: { mode: 'dark' } },
    dpr: 1,
  });

  const copyOpen = await waitFor(() => {
    const el = slot.querySelector<HTMLElement>('[data-fg-copy]:not([data-pending]) .fg-live-test-open');
    if (!el) throw new Error('no copy yet');
    return el;
  });
  copyOpen.click();
  const popover = await waitFor(() => {
    const el = slot.querySelector<HTMLElement>('[data-fg-copy] [role="dialog"]');
    if (!el) throw new Error('no popover yet');
    return el;
  });
  const reference = await screen.findByRole('dialog', { name: 'Reference' });

  // The popover lives in the copy, so the lens clips it: no part of it paints over the lab. It opens against the
  // copy's trigger, its 12px offset drawn at the lens's factor like the rest of the copy.
  expect(slot.contains(popover)).toBe(true);
  const lens = slot.getBoundingClientRect();
  const box = popover.getBoundingClientRect();
  const trigger = copyOpen.getBoundingClientRect();
  const overlay = popover.closest('[data-weasel-overlay]')!.getBoundingClientRect();
  expect(overlay.top).toBeCloseTo(trigger.bottom + 12 * 2, 0);
  expect(overlay.left + overlay.width / 2).toBeCloseTo(trigger.left + trigger.width / 2, 0);
  const outside = { x: box.left + box.width / 2, y: Math.max(box.top + 4, lens.bottom + 4) };
  expect(document.elementFromPoint(center(copyOpen).x, center(copyOpen).y)).toBe(copyOpen);
  expect(popover.contains(document.elementFromPoint(outside.x, outside.y))).toBe(false);
  // The fill is the popover's, around the dialog.
  const fill = (el: Element) => getComputedStyle(el.closest('[data-weasel-overlay]')!).backgroundColor;
  expect(fill(popover)).not.toBe('rgba(0, 0, 0, 0)');
  expect(fill(popover)).toBe(fill(reference));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it('backs a copy of an isolated story with the compared mode’s background, not the lab’s', async () => {
  const lenses = createLiveLenses();
  const isolated: IndexEntry = { ...tall, id: 'l--isolated', isolate: 'test' };
  // A variable, not a literal, so the option reads the same before and after storyInstrument took a setup.
  const options = { entry: isolated, answers: createAnswerBook(), frameUrl: 'about:blank', onReady: () => {}, setup };
  const instrument = storyInstrument(options);
  const { container } = renderWithIcons(
    <LiveLensesContext.Provider value={lenses}>
      <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
        <div className="fg-live-test-host" data-wzl-mode="light">
          <Lab instruments={[instrument]} defaultInstrument={isolated.id} />
        </div>
      </StoryGlobalsContext.Provider>
      <div className="fg-live-test-slot" />
      <div className="fg-live-test-backing" data-wzl-mode="dark" />
      <div className="fg-live-test-backing" data-wzl-mode="light" />
    </LiveLensesContext.Provider>,
  );
  const host = await waitFor(() => {
    const el = container.querySelector<HTMLElement>('.fg-frame-host:not([data-fg-copy])');
    if (!el || el.getBoundingClientRect().width === 0) throw new Error('no frame host yet');
    return el;
  });
  const slot = container.querySelector<HTMLElement>('.fg-live-test-slot')!;
  const source = createLiveSource(lenses, resolveComparison, () => ({
    base: { mode: 'light' },
    ctx: { declarations: {}, modeGlobal: 'mode', prefersDark: false, labMode: 'light' },
  }));
  source.attach(slot, {
    lensId: 'a',
    reticle: center(host),
    factor: 2,
    size: { width: 200, height: 200 },
    conditions: { kind: 'opposite-mode' },
    dpr: 1,
  });
  const copy = await waitFor(() => {
    const el = slot.querySelector<HTMLElement>('.fg-lens-copy > .fg-frame-host[data-fg-copy]');
    if (!el) throw new Error('no copy yet');
    return el;
  });
  const fill = (el: Element) => getComputedStyle(el).backgroundColor;
  const [dark, light] = [...container.querySelectorAll('.fg-live-test-backing')];
  expect(fill(dark!)).not.toBe(fill(light!));
  await waitFor(() => expect(fill(copy)).toBe(fill(dark!)));
});
