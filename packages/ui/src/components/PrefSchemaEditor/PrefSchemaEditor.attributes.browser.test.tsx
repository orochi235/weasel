import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

// Where the attributes pane starts, and which of its rows share an edge, is the browser's layout to say.

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } } },
};

const mount = async () => {
  await page.viewport(1300, 720);
  return render(
    <div style={{ width: 1280, height: 700 }}>
      <PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />
    </div>,
  );
};

test('with nothing to say, the notice leaves the attributes pane at the top of its column', async () => {
  await mount();
  const structure = screen.getByRole('region', { name: 'Structure' }).getBoundingClientRect();
  const attributes = screen.getByRole('region', { name: 'Attributes' }).getBoundingClientRect();
  expect(attributes.top).toBe(structure.top);
});
