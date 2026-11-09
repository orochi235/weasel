import { describe, expect, it } from 'vitest';
import { stencilTool } from './stencilTool';

describe('stencilTool', () => {
  it('carries the stencil’s description into its presentation, and leaves it out when there is none', () => {
    expect(stencilTool({ id: 'box', label: 'Box', description: 'A plain box' }).presentation)
      .toMatchObject({ label: 'Box', description: 'A plain box', group: 'stencil' });
    expect(stencilTool({ id: 'box', label: 'Box' }).presentation).not.toHaveProperty('description');
  });
});
