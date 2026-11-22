import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MermaidKindsDemo } from '../MermaidKindsDemo';

const read = vi.hoisted(() => ({ fail: null as 'throw' | 'reject' | null }));
vi.mock('@weasel-js/diagram-formats', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/diagram-formats')>();
  return {
    ...real,
    DIAGRAM_MERMAID: {
      ...real.DIAGRAM_MERMAID,
      read: (text: string) => {
        if (read.fail === 'throw') throw new Error('bad sample');
        if (read.fail === 'reject') return Promise.reject(new Error('bad sample'));
        return real.DIAGRAM_MERMAID.read!(text);
      },
    },
  };
});
vi.mock('@weasel-js/diagram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/diagram')>()),
  DiagramView: ({ specs }: { specs: unknown[] }) => <output aria-label="diagram">{specs.length}</output>,
}));

afterEach(() => { cleanup(); read.fail = null; });

describe('MermaidKindsDemo', () => {
  it.each(['throw', 'reject'] as const)('shows a sample that fails to read (%s) in place of the last diagram', async (how) => {
    render(<MermaidKindsDemo />);
    await waitFor(() => expect(Number(screen.getByLabelText('diagram').textContent)).toBeGreaterThan(0));
    read.fail = how;
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'state' })); });
    expect((await screen.findByRole('alert')).textContent).toContain('bad sample');
    expect(screen.getByLabelText('diagram').textContent).toBe('0');
  });
});
