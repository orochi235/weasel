import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { PrefGroup } from '@weasel-js/prefs';
import { ExportPanel } from './ExportPanel';
import { setAttribute } from './schemaEdit';
import { diffSchemas, printSchema } from './schemaExport';

afterEach(cleanup);

const BASE: PrefGroup = { name: 'Root', children: { snap: { kind: 'boolean', name: 'Snap', description: '', default: false } } };
const EDITED = setAttribute(BASE, 'snap', 'name', 'Snap to grid');
const CHANGES = diffSchemas(BASE, EDITED);
const submit = () => screen.getByRole('button', { name: /Submit|Sending|Sent|Failed/ });

describe('ExportPanel', () => {
  it('draws the literal plain first and colors it after, as the same text', async () => {
    // Out of act: act would run the deferred render before the first could be read.
    const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const was = actEnv.IS_REACT_ACT_ENVIRONMENT;
    actEnv.IS_REACT_ACT_ENVIRONMENT = false;
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    try {
      const literal = () => host.querySelector('[data-testid=schema-literal]')!;
      const text = () => [...literal().querySelectorAll('code > span')].map((line) => line.textContent).join('\n');
      flushSync(() => root.render(<ExportPanel schema={EDITED} changes={CHANGES} />));
      expect(literal().querySelector('.token')).toBeNull();
      expect(text()).toBe(printSchema(EDITED));
      await waitFor(() => expect(literal().querySelector('.token')).not.toBeNull());
      expect(text()).toBe(printSchema(EDITED));
    } finally {
      root.unmount();
      host.remove();
      actEnv.IS_REACT_ACT_ENVIRONMENT = was;
    }
  });

  it('draws no submit button unless it is given somewhere to submit to', () => {
    render(<ExportPanel schema={EDITED} changes={CHANGES} />);
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });

  it('has nothing to submit while nothing has changed', () => {
    render(<ExportPanel schema={BASE} changes={[]} onSubmit={vi.fn()} />);
    expect(submit()).toBeDisabled();
  });

  it('submits the changes with the literal, and says when they were taken', async () => {
    let done!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { done = resolve; }));
    render(<ExportPanel schema={EDITED} changes={CHANGES} onSubmit={onSubmit} />);
    fireEvent.click(submit());
    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledWith(CHANGES, printSchema(EDITED));
    done();
    expect(await screen.findByRole('button', { name: 'Sent' })).toBeEnabled();
  });

  it('says so when the submit fails, whether it rejects or throws', async () => {
    const view = render(<ExportPanel schema={EDITED} changes={CHANGES} onSubmit={() => Promise.reject(new Error('down'))} />);
    fireEvent.click(submit());
    expect(await screen.findByRole('button', { name: 'Failed' })).toBeEnabled();
    view.unmount();
    render(<ExportPanel schema={EDITED} changes={CHANGES} onSubmit={() => { throw new Error('down'); }} />);
    fireEvent.click(submit());
    expect(await screen.findByRole('button', { name: 'Failed' })).toBeInTheDocument();
  });

  it('offers to submit again once the changes are different ones', async () => {
    const view = render(<ExportPanel schema={EDITED} changes={CHANGES} onSubmit={() => {}} />);
    fireEvent.click(submit());
    await screen.findByRole('button', { name: 'Sent' });
    const more = setAttribute(EDITED, 'snap', 'description', 'Sticks to the grid.');
    view.rerender(<ExportPanel schema={more} changes={diffSchemas(BASE, more)} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });
});
