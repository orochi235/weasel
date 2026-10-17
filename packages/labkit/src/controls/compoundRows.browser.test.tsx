import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
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

beforeAll(() => page.viewport(720, 600));

test.each([
  ['Stop', 2],
  ['Limits', 4],
  ['Ramp', 1],
] as const)('a row opens %s in a dialog with room for its controls', async (label, count) => {
  renderWithIcons(<Panel />);
  fireEvent.click(screen.getByRole('button', { name: `Edit ${label}` }));
  const dialog = await screen.findByRole('dialog');
  const box = dialog.getBoundingClientRect();
  const shown = [...dialog.querySelectorAll('input')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0);
  expect(shown.length).toBeGreaterThanOrEqual(count);
  for (const r of shown) {
    expect(r.width).toBeGreaterThan(20);
    expect(r.left).toBeGreaterThanOrEqual(box.left);
    expect(r.right).toBeLessThanOrEqual(box.right);
  }
});
