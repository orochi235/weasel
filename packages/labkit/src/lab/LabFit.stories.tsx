import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactNode, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { TrialContribution } from '../chrome/types';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import './LabFit.stories.less';

// A lab must fit whatever it is mounted in without scrolling. jsdom cannot see
// layout, so these run in the storybook vitest project's real browser.

const Stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div>stub</div>,
};

const floater: TrialContribution = {
  id: 'floater',
  region: 'sidebar',
  item: { title: 'Floater', undockAs: 'floating', body: <p>floating panel</p> },
};

const VIEWPORTS = {
  wide: { name: '1280x800', styles: { width: '1280px', height: '800px' } },
  medium: { name: '800x600', styles: { width: '800px', height: '600px' } },
  narrow: { name: '400x700', styles: { width: '400px', height: '700px' } },
};

type Host = 'reset' | 'wrapped' | 'framed';

// Storybook wraps every story in divs of its own, so a fixture that needs a
// known ancestor chain builds that chain directly on <body> and portals into it.
function BodyHost({ host, children }: { host: Host; children: ReactNode }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const outer = document.createElement('div');
    outer.className = `lk-fit-host lk-fit-host--${host}`;
    let target = outer;
    if (host === 'wrapped') {
      target = document.createElement('div');
      outer.appendChild(target);
    }
    if (host === 'framed') {
      // apps/site's shape: page content above a fixed-height frame.
      const heading = document.createElement('div');
      heading.className = 'lk-fit-heading';
      target = document.createElement('div');
      target.className = 'lk-fit-frame';
      outer.append(heading, target);
    }
    document.body.appendChild(outer);
    setMount(target);
    return () => outer.remove();
  }, [host]);
  return mount ? createPortal(children, mount) : null;
}

type Fixture = 'fullscreen' | 'floating' | 'wrapped' | 'framed';

const HOST: Record<Fixture, Host> = {
  fullscreen: 'reset',
  floating: 'reset',
  wrapped: 'wrapped',
  framed: 'framed',
};

function scrolls(el: Element): string[] {
  const out: string[] = [];
  if (el.scrollHeight > el.clientHeight)
    out.push(`scrollHeight ${el.scrollHeight} > ${el.clientHeight}`);
  if (el.scrollWidth > el.clientWidth)
    out.push(`scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
  return out;
}

function fitProblems(fixture: Fixture, viewport: keyof typeof VIEWPORTS): string[] {
  const problems: string[] = [];
  const want = VIEWPORTS[viewport].styles;
  const got = `${window.innerWidth}px x ${window.innerHeight}px`;
  if (got !== `${want.width} x ${want.height}`) problems.push(`viewport is ${got}`);

  // A box that spills out of the lab is overflow even where the page has room
  // to absorb it, which is how a 100vh shell hid inside an embedded lab.
  const labBox = document.querySelector('.lk-lab')?.getBoundingClientRect();
  const shellBox = document.querySelector('.lk-shell')?.getBoundingClientRect();
  if (!labBox || !shellBox) return [...problems, 'no .lk-lab or .lk-shell'];
  if (shellBox.bottom > labBox.bottom + 1 || shellBox.right > labBox.right + 1) {
    problems.push(
      `.lk-shell ${shellBox.bottom}/${shellBox.right} spills out of .lk-lab ${labBox.bottom}/${labBox.right}`,
    );
  }

  const doc = document.scrollingElement ?? document.documentElement;
  for (const p of scrolls(doc)) problems.push(`document: ${p}`);

  const body = document.querySelector('.lk-shell-body');
  if (!body) return ['no .lk-shell-body'];
  for (const p of scrolls(body)) problems.push(`.lk-shell-body: ${p}`);

  const tiles = [...document.querySelectorAll('.lk-trial-tile')];
  if (tiles.length === 0) problems.push('no .lk-trial-tile');
  tiles.forEach((t, i) => {
    const h = t.getBoundingClientRect().height;
    if (!(h > 0)) problems.push(`tile ${i}: height ${h}`);
  });

  if (fixture === 'framed') {
    const frame = document.querySelector('.lk-fit-frame');
    const lab = document.querySelector('.lk-lab');
    const f = frame?.getBoundingClientRect();
    const l = lab?.getBoundingClientRect();
    if (!f || !l) return [...problems, 'no frame or lab'];
    if (Math.abs(l.height - f.height) > 1)
      problems.push(`lab height ${l.height} != frame ${f.height}`);
  }

  if (fixture === 'floating') {
    const panel = document.querySelector('.lk-panel-tile--floating')?.getBoundingClientRect();
    const host = document.querySelector('.lk-workspace-host')?.getBoundingClientRect();
    if (!panel || !host) return [...problems, 'no floating panel or workspace host'];
    if (panel.top < host.top || panel.right > host.right + 1) {
      problems.push(
        `floating panel ${panel.top},${panel.right} outside workspace ${host.top},${host.right}`,
      );
    }
  }
  return problems;
}

function fit(fixture: Fixture, viewport: keyof typeof VIEWPORTS): Story {
  return {
    globals: { viewport: { value: viewport, isRotated: false } },
    render: () => (
      <BodyHost host={HOST[fixture]}>
        <Lab
          title={`Fit: ${fixture}`}
          instruments={[Stub]}
          defaultInstrument="Stub"
          chrome={fixture === 'floating' ? [floater] : undefined}
        />
      </BodyHost>
    ),
    play: async () => {
      if (fixture === 'floating') {
        const undock = await within(document.body).findByRole('button', { name: 'Undock Floater' });
        await userEvent.click(undock);
      }
      await waitFor(
        () => {
          const problems = fitProblems(fixture, viewport);
          if (problems.length > 0) throw new Error(problems.join('; '));
        },
        { timeout: 2000 },
      );
      await expect(fitProblems(fixture, viewport)).toEqual([]);
    },
  };
}

const meta: Meta<typeof Lab> = {
  title: 'labkit/Lab/Fit',
  component: Lab,
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
};
export default meta;

type Story = StoryObj<typeof Lab>;

export const FullscreenWide = fit('fullscreen', 'wide');
export const FullscreenMedium = fit('fullscreen', 'medium');
export const FullscreenNarrow = fit('fullscreen', 'narrow');

export const FloatingPanelWide = fit('floating', 'wide');
export const FloatingPanelMedium = fit('floating', 'medium');
export const FloatingPanelNarrow = fit('floating', 'narrow');

export const WrappedNoResetWide = fit('wrapped', 'wide');
export const WrappedNoResetMedium = fit('wrapped', 'medium');
export const WrappedNoResetNarrow = fit('wrapped', 'narrow');

export const FramedWide = fit('framed', 'wide');
export const FramedMedium = fit('framed', 'medium');
export const FramedNarrow = fit('framed', 'narrow');
