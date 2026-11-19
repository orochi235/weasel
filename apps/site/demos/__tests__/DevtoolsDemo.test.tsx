import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '../../testIcons';
import { DevtoolsDemo } from '../DevtoolsDemo';

beforeAll(() => {
  const recorder = createGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});
afterEach(cleanup);

describe('DevtoolsDemo', () => {
  it('lists its canvas in the panel, with the scene\'s nodes, and opens the state tab', async () => {
    renderWithIcons(<DevtoolsDemo />);
    expect(await screen.findByRole('button', { name: /Devtools demo canvas/ })).toBeTruthy();
    await waitFor(() => screen.getByRole('treeitem', { name: /^boat\b/ }));
    expect(screen.getByRole('treeitem', { name: /^sun\b/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'State' }));
    expect(screen.getByRole('tab', { name: 'State' }).getAttribute('aria-selected')).toBe('true');
  });
});
