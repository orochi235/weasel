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

it('keeps a vertical bar to a toolbar\'s width, turning a field too wide for it and leaving one that fits upright', async () => {
  const fields: PrefGroup = {
    name: 'Type',
    as: 'bar',
    children: {
      size: { kind: 'number', name: 'Size', description: '', default: 12 } as PrefLeaf,
      align: {
        kind: 'enum', name: 'Align', description: '', default: 'left',
        options: ['Left', 'Center', 'Right', 'Justify'].map((label) => ({ value: label.toLowerCase(), label })),
      } as PrefLeaf,
    },
  };
  const { container } = renderWithIcons(<Bar schema={fields} values={{}} orientation="vertical" label="Type" />);
  await new Promise((r) => requestAnimationFrame(r));
  const bar = container.querySelector<HTMLElement>('div[data-orientation="vertical"]')!;
  expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(40);
  const turned = [...bar.querySelectorAll('[data-turned]')];
  expect(turned).toHaveLength(1);
  expect(turned[0]!.textContent).toContain('Left');
});
