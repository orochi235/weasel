import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../../styles.less';
import '../../lab/presentation.browser.test.less';
import { cleanup } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';
import type { Instrument } from '../../instrument/types';
import { Lab } from '../../lab/Lab';
import type { LabContribution } from '../labTypes';
import type { TrialContribution } from '../types';

afterEach(cleanup);

const Stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div>stub</div>,
};

const stories: LabContribution = {
  id: 'stories',
  region: 'sidebar',
  item: { title: 'Stories', body: <p>a story</p> },
};

const controls: TrialContribution = {
  id: 'controls',
  region: 'sidebar',
  item: { title: 'Controls', body: <p>a control</p> },
};

const frames = (n: number) =>
  new Promise<void>((done) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : done());
    step(n);
  });

// windease remounts the panels a lab's sidebar stacks while it settles. A ResizeObserver left on a section bar
// it removed reported the bar shrinking to nothing, and Chrome raised that as a loop error on every lab's load.
test('a lab with sidebar sections loads without a ResizeObserver loop error', async () => {
  const errors: string[] = [];
  const onError = (e: ErrorEvent) => errors.push(e.message);
  window.addEventListener('error', onError);
  try {
    const { container } = renderWithIcons(
      <div className="lk-present-frame">
        <Lab
          instruments={[Stub]}
          defaultInstrument="Stub"
          chrome={[controls]}
          labChrome={[stories]}
        />
      </div>,
    );
    await expect.poll(() => container.querySelectorAll('.lk-sidebar-section__bar').length).toBe(2);
    await frames(10);
    expect(errors.filter((m) => m.includes('ResizeObserver'))).toEqual([]);
  } finally {
    window.removeEventListener('error', onError);
  }
});
