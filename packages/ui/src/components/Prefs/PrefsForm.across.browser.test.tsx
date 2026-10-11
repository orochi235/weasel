import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefsForm } from './PrefsForm';

// Whether a control sits beside its label or under it is the browser's flex wrapping to decide.

beforeAll(() => page.viewport(1000, 600));
afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        rulers: { kind: 'boolean', name: 'Show rulers', description: 'Along the top and left.', default: false },
        unit: { kind: 'string', name: 'Unit', description: '', default: 'px' },
      },
    },
  },
};

it('keeps a checkbox on its label\'s line, two across, where a wider control would wrap', async () => {
  const { container } = render(
    <div style={{ width: 900, height: 400, display: 'flex' }}>
      <PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" rowsAcross={2} />
    </div>,
  );
  await document.fonts.ready;
  const row = container.querySelector('[data-pref-path="canvas.rulers"]')!;
  const label = [...row.querySelectorAll('span')].find((el) => el.textContent?.includes('Show rulers'))!;
  const box = row.querySelector('input[type="checkbox"]')!;
  expect(box.getBoundingClientRect().top).toBeLessThan(label.getBoundingClientRect().bottom);
});
