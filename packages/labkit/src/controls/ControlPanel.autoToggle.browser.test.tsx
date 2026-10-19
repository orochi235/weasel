import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

// Whether a click on the label reaches the label is a question of what is
// drawn on top of it, which only a browser lays out.

afterEach(cleanup);

const schema = f.schema({ bloom: f.number(0.9).range(0, 3).step(0.05).auto().label('Bloom') });

/** Uncontrolled, so the panel keeps the auto set and every row starts pinned. */
function Panel({ density }: { density?: 'tight' }) {
  const [config, setConfig] = useState<Record<string, unknown>>({ bloom: 0.9 });
  return (
    <div className="lk-root">
      <ControlPanel
        schema={resolveConfigSchema(schema)}
        config={config}
        setConfig={(path, value) => setConfig((was) => ({ ...was, [path]: value }))}
        {...(density ? { density } : {})}
      />
    </div>
  );
}

/** The element a click at the toggle's center lands on. */
function hitAtCenter(el: Element): Element | null {
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
}

describe.each([undefined, 'tight' as const])('a pinned slider row, density %s', (density) => {
  test('keeps its label on top, so a click on it can return the row to auto', () => {
    render(<Panel density={density} />);
    const toggle = screen.getByRole('button', { name: 'Pin Bloom' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const hit = hitAtCenter(toggle);
    expect(hit === toggle || toggle.contains(hit), `landed on ${hit?.outerHTML.slice(0, 60)}`).toBe(true);
  });
});
