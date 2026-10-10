import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { f } from '../config/builder';
import { withValueAtPath } from '../config/path';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

// Whether a dialog opened from a row gives an object's rows, a map's entries and a union's
// fields room to be used is a fact of layout, which jsdom has none of.

afterEach(cleanup);

const schema = f.schema({
  stop: f.object({ at: f.number(0.5).range(0, 1), color: f.color('#1d4ed8') }),
  limits: f.map({ studio: 8, laptop: 2 }, f.number(4).label('Limit')),
  ramp: f.union('type', {
    linear: f.object({ angle: f.number(90) }),
    radial: f.object({ radius: f.number(1) }),
  }),
});
const resolved = resolveConfigSchema(schema);

function Panel() {
  const [config, setConfig] = useState<Record<string, unknown>>(
    schema.defaults() as Record<string, unknown>,
  );
  return (
    <div className="lk-root" data-testid="panel">
      <ControlPanel
        schema={resolved}
        config={config}
        setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
      />
    </div>
  );
}

async function opened(label: string): Promise<{ box: DOMRect; inputs: DOMRect[] }> {
  await userEvent.click(screen.getByRole('button', { name: `Edit ${label}` }));
  const dialog = await screen.findByRole('dialog');
  const inputs = [...dialog.querySelectorAll('input')].map((el) => el.getBoundingClientRect());
  const box = dialog.getBoundingClientRect();
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  return { box, inputs };
}

test('a row opens an object, a map and a union in a dialog with room for their controls', async () => {
  await page.viewport(720, 600);
  render(<Panel />);
  for (const [label, count] of [
    ['Stop', 2],
    ['Limits', 4],
    ['Ramp', 1],
  ] as const) {
    const { box, inputs } = await opened(label);
    const shown = inputs.filter((r) => r.width > 0);
    expect(shown.length, label).toBeGreaterThanOrEqual(count);
    for (const r of shown) {
      expect(r.width, label).toBeGreaterThan(20);
      expect(r.left, label).toBeGreaterThanOrEqual(box.left);
      expect(r.right, label).toBeLessThanOrEqual(box.right);
    }
  }
});
