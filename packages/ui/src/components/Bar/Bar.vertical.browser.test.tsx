import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { icon } from '../../icons.gen';
import { Bar } from './Bar';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const panel = (name: string, extra: Partial<PrefGroup> = {}): PrefGroup => ({
  name,
  as: 'panel',
  children: { on: { kind: 'boolean', name: 'On', description: '', default: false } as PrefLeaf },
  ...extra,
});

const schema: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: { spacing: panel('Line spacing'), size: panel('Type size', { icon: icon('close') }) },
};

it("turns a vertical bar's button with no glyph to read along the bar, and shows one with a glyph by it alone", () => {
  renderWithIcons(<Bar schema={schema} values={{}} orientation="vertical" label="Text" />);
  const turned = screen.getByRole('button', { name: 'Line spacing' }).getBoundingClientRect();
  expect(turned.height).toBeGreaterThan(turned.width * 2);
  const glyph = screen.getByRole('button', { name: 'Type size' }).getBoundingClientRect();
  expect(glyph.width).toBeLessThan(turned.height / 2);
});
