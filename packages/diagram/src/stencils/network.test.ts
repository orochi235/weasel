import { describe, expect, it } from 'vitest';
import { outlineDetail, outlinePath } from '../outline';
import { NETWORK_GROUP, NETWORK_STENCILS } from './network';
import { builtNodes, expectLabelUnder, expectStencilsBuild } from './stencils.fixture';

const LABELED_INSIDE = new Set(['database', 'cloud']);

describe('the network group', () => {
  it('builds every device', () => {
    expect(NETWORK_STENCILS.map((s) => s.id)).toEqual([
      'server', 'database', 'cloud', 'router', 'switch', 'firewall', 'laptop', 'desktop', 'phone', 'printer', 'user',
      'internet',
    ]);
    expectStencilsBuild(NETWORK_GROUP);
  });

  it('labels each device under its drawing', () => {
    for (const s of NETWORK_STENCILS) if (!LABELED_INSIDE.has(s.id)) expectLabelUnder(s);
  });

  it('draws interior lines over every new device but the user', () => {
    for (const s of NETWORK_STENCILS) {
      if (LABELED_INSIDE.has(s.id) || s.id === 'user') continue;
      const [body] = builtNodes(s);
      expect(outlineDetail(s.outline, body!.pose), s.id).not.toBeNull();
    }
  });

  it('paints a saved and reopened device the same', () => {
    const server = NETWORK_STENCILS.find((s) => s.id === 'server')!;
    const [body] = builtNodes(server);
    const reopened = JSON.parse(JSON.stringify(body)) as typeof body;
    expect(outlinePath(reopened!.data.diagram!.outline as string, reopened!.pose)).toEqual(outlinePath('server', body!.pose));
  });
});
