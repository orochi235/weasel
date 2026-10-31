import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { icon } from '../../icons.gen';
import { Bar } from './Bar';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const schema: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    leading: { kind: 'number', name: 'Line spacing', description: '', default: 1.2 } as PrefLeaf,
    size: { kind: 'number', name: 'Type size', description: '', default: 12, icon: icon('close') } as PrefLeaf,
  },
};

it("turns a vertical bar's button with no glyph to read along the bar, and shows one with a glyph by it alone", () => {
  renderWithIcons(<Bar schema={schema} values={{}} orientation="vertical" label="Text" />);
  const turned = screen.getByRole('button', { name: 'Line spacing' }).getBoundingClientRect();
  expect(turned.height).toBeGreaterThan(turned.width * 2);
  const glyph = screen.getByRole('button', { name: 'Type size' }).getBoundingClientRect();
  expect(glyph.width).toBeLessThan(turned.height / 2);
  expect(screen.getByRole('toolbar').getBoundingClientRect().width).toBeLessThanOrEqual(Math.max(turned.width, glyph.width) + 1);
});
