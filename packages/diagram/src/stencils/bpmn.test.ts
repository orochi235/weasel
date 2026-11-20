import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/core';
import { contentBox, outlineDetail, outlinePath, outlineSolid } from '../outline';
import { BPMN_GROUP, BPMN_STENCILS } from './bpmn';
import { builtNodes, expectLabelUnder, expectStencilsBuild } from './stencils.fixture';

const byId = (id: string) => BPMN_STENCILS.find((s) => s.id === id)!;
const SMALL = ['start-event', 'intermediate-event', 'end-event', 'exclusive-gateway', 'parallel-gateway', 'inclusive-gateway', 'event-gateway'];

describe('the bpmn group', () => {
  it('builds every symbol', () => {
    expectStencilsBuild(BPMN_GROUP);
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

  it('draws an end event as its own outline, a heavy ring filled inside the circle, not a restyled start event', () => {
    const end = byId('end-event');
    expect(end.outline).toBe('endEvent');
    expect(end.style).toBeUndefined();
    const [body] = builtNodes(end);
    const ring = outlineSolid(end.outline, body!.pose);
    expect(ring).not.toBeNull();
    const circle = boundsOfPath(outlinePath(end.outline, body!.pose));
    const filled = boundsOfPath(ring!);
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(filled[k], k).toBeCloseTo(circle[k], 6);
    expect(outlineSolid(byId('start-event').outline, body!.pose)).toBeNull();
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
