import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/core';
import { contentBox, outlineDetail, outlinePath } from '../outline';
import { BPMN_STENCILS } from './bpmn';
import { builtNodes, expectLabelUnder, expectStencilsBuild } from './stencilFixture';

const byId = (id: string) => BPMN_STENCILS.find((s) => s.id === id)!;
const SMALL = ['start-event', 'intermediate-event', 'end-event', 'exclusive-gateway', 'parallel-gateway', 'inclusive-gateway', 'event-gateway'];

describe('the bpmn group', () => {
  it('builds every symbol', () => {
    expectStencilsBuild(BPMN_STENCILS);
  });

  it('draws events 40px and gateways 50px across, labeled underneath', () => {
    for (const id of SMALL) {
      const s = byId(id);
      expectLabelUnder(s);
      const [body] = builtNodes(s);
      const drawn = boundsOfPath(outlinePath(s.outline, body!.pose));
      const side = id.endsWith('event') ? 40 : 50;
      expect(drawn.width, id).toBeCloseTo(side, 1);
      expect(drawn.height, id).toBeCloseTo(side, 1);
    }
  });

  it('draws an end event with a heavier ring than a start event', () => {
    const width = (id: string) => (builtNodes(byId(id))[0]!.data as { stroke: { width: number } }).stroke.width;
    expect(width('end-event')).toBeGreaterThan(width('start-event'));
  });

  it('marks every gateway and the subprocess', () => {
    for (const id of ['exclusive-gateway', 'parallel-gateway', 'inclusive-gateway', 'event-gateway', 'subprocess']) {
      const [body] = builtNodes(byId(id));
      expect(outlineDetail(byId(id).outline, body!.pose), id).not.toBeNull();
    }
  });

  it("keeps a subprocess's label clear of its boxed plus", () => {
    const s = byId('subprocess');
    const [body] = builtNodes(s);
    const marker = boundsOfPath(outlineDetail(s.outline, body!.pose)!);
    const content = contentBox(s.outline, body!.pose);
    expect(content.y + content.height).toBeLessThanOrEqual(marker.y);
    expect(marker.x + marker.width / 2).toBeCloseTo(body!.pose.x + body!.pose.width / 2, 6);
  });
});
