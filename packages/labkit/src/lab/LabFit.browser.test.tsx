import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './LabFit.browser.test.less';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { LabContribution } from '../chrome/labTypes';
import type { TrialContribution } from '../chrome/types';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

// A lab must fit whatever it is mounted in without scrolling, which only real
// layout can show.

afterEach(cleanup);

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

const sidebarTree: LabContribution = {
  id: 'tree',
  region: 'sidebar',
  item: {
    title: 'Stories',
    body: Array.from({ length: 40 }, (_, i) => `Story ${i + 1}`).map((name) => (
      <p key={name}>{name}</p>
    )),
  },
};

const VIEWPORTS = {
  wide: { name: '1280x800', styles: { width: '1280px', height: '800px' } },
  medium: { name: '800x600', styles: { width: '800px', height: '600px' } },
  narrow: { name: '400x700', styles: { width: '400px', height: '700px' } },
};

type Host = 'reset' | 'wrapped' | 'framed';

// The frame wraps every story in divs of its own, so a fixture that needs a
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

type Fixture = 'fullscreen' | 'floating' | 'wrapped' | 'framed' | 'sidebar';

const HOST: Record<Fixture, Host> = {
  fullscreen: 'reset',
  sidebar: 'reset',
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

  if (fixture === 'sidebar') {
    const side = document.querySelector('.lk-lab__sidebar')?.getBoundingClientRect();
    // The host wraps the grid only once a panel is undocked.
    const work = document
      .querySelector('.lk-lab__main > .lk-workspace-host, .lk-lab__main > .lk-workspace')
      ?.getBoundingClientRect();
    if (!side) return [...problems, 'no .lk-lab__sidebar'];
    if (!work) return [...problems, 'no workspace in .lk-lab__main'];
    if (!(side.width > 0)) problems.push(`lab sidebar width ${side.width}`);
    if (!(work.width > 0)) problems.push(`workspace width ${work.width}`);
    if (work.left < side.right - 1) {
      problems.push(`workspace left ${work.left} overlaps sidebar right ${side.right}`);
    }
  }
  return problems;
}

const FIXTURES: Fixture[] = ['fullscreen', 'floating', 'wrapped', 'framed', 'sidebar'];
const CASES = FIXTURES.flatMap((fixture) =>
  (Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]).map((viewport) => ({ fixture, viewport })),
);

test.each(CASES)('$fixture fits a $viewport viewport', async ({ fixture, viewport }) => {
  const { width, height } = VIEWPORTS[viewport].styles;
  await page.viewport(Number.parseInt(width, 10), Number.parseInt(height, 10));
  render(
    <BodyHost host={HOST[fixture]}>
      <Lab
        title={`Fit: ${fixture}`}
        instruments={[Stub]}
        defaultInstrument="Stub"
        chrome={fixture === 'floating' ? [floater] : undefined}
        labChrome={fixture === 'sidebar' ? [sidebarTree] : undefined}
      />
    </BodyHost>,
  );
  if (fixture === 'floating') {
    await userEvent.click(await screen.findByRole('button', { name: 'Undock Floater' }));
  }
  await waitFor(
    () => {
      const problems = fitProblems(fixture, viewport);
      if (problems.length > 0) throw new Error(problems.join('; '));
    },
    { timeout: 2000 },
  );
  expect(fitProblems(fixture, viewport)).toEqual([]);
});
