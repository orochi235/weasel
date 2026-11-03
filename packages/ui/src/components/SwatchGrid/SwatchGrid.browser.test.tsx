import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { SwatchGrid } from '@weasel-js/ui/components/SwatchGrid';

afterEach(cleanup);

test('a glyph sits centered over its swatch in its ink, without growing it', async () => {
  await page.viewport(800, 600);
  render(
    <div style={{ width: 240 }}>
      <SwatchGrid
        aria-label="Tapes"
        columns={6}
        onChange={() => {}}
        options={[
          { id: 'plain', value: '#2a7ab0ff', label: 'Plain' },
          { id: 'inked', value: '#2a7ab0ff', label: 'Inked', glyph: 'A', ink: 'rgb(255, 255, 255)' },
        ]}
      />
    </div>,
  );
  const plain = screen.getByRole('button', { name: 'Plain' }).getBoundingClientRect();
  const button = screen.getByRole('button', { name: 'Inked' });
  const box = button.getBoundingClientRect();
  expect(box.height).toBeCloseTo(plain.height, 1);
  const glyph = within(button).getByText('A');
  expect(getComputedStyle(glyph).color).toBe('rgb(255, 255, 255)');
  const g = glyph.getBoundingClientRect();
  expect(g.left + g.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
  expect(g.top + g.height / 2).toBeCloseTo(box.top + box.height / 2, 0);
});
