/** The package's story is its reference demo, so the canvas it mounts takes the panel's steering. */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import meta from './DevtoolsPanel.stories';
import { rootByLabel, stubWebGL } from './testing/mountCanvas';

beforeAll(stubWebGL);
afterEach(cleanup);

describe('the DevtoolsPanel story', () => {
  it('mounts a canvas with every tool it names, whose selection the panel can set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const Story = meta.component!;
      render(<Story />);
      await waitFor(() => rootByLabel('Story board'));
      const root = rootByLabel('Story board');
      expect(root.source.tools()).toEqual(expect.arrayContaining(['hand', 'rect']));
      act(() => root.source.select(['card']));
      expect(root.source.selection()).toEqual(['card']);
      // The panel's icons come from the registry forge provides, which this render leaves out.
      expect(warn.mock.calls.filter(([m]) => !String(m).includes('no icon'))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
