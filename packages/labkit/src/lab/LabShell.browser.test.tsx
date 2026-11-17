import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './LabShell.browser.test.less';
import { cleanup } from '@testing-library/react';
import { Lab } from '@weasel-js/labkit';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';
import type { Instrument } from '../instrument/types';

afterEach(cleanup);

const Plain: Instrument = {
  name: 'Plain',
  initialState: () => ({}),
  canvas: { layers: [{ id: 'fill', draw: () => {} }] },
  render: () => null,
};

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// A header whose height followed its face moved the whole lab a pixel when the face arrived,
// and refit every trial's view a second time.
test('the header is as tall in any face, with its actions shown or folded into the menus', async () => {
  const heights = new Set<number>();
  for (const frameClass of ['lk-shell-frame', 'lk-shell-frame lk-shell-frame--wide']) {
    const { container } = renderWithIcons(
      <div className={frameClass}>
        <Lab instruments={[Plain, { ...Plain, name: 'Other' }]} />
      </div>,
    );
    await document.fonts.ready;
    const header = container.querySelector('.lk-shell-header') as HTMLElement;
    for (const face of ['', "'Courier New'", 'Georgia', 'system-ui']) {
      header.style.setProperty('--wzl-font-ui', face ? `${face}, sans-serif` : '');
      await frame();
      heights.add(header.getBoundingClientRect().height);
    }
    cleanup();
  }
  expect([...heights]).toHaveLength(1);
});
