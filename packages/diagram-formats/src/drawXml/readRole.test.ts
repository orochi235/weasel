import { describe, expect, it } from 'vitest';
import { DIAGRAM_DRAW_XML } from './format';
import { ROLE_KEY } from './cells';
import { asGraph } from '../testing/asGraph';

const cell = (id: string, parent: string, style: string, x: number, y: number, w: number, h: number): string =>
  `<mxCell id="${id}" value="${id}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;

describe('reading a swimlane by its role mark', () => {
  it('reads a swimlane marked as a container inside a pool as a container, not a lane', async () => {
    const text = '<mxfile><diagram id="p"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
      + cell('pool', '1', `swimlane;horizontal=0;startSize=30;${ROLE_KEY}=pool;`, 0, 0, 400, 200)
      + cell('L', 'pool', 'swimlane;horizontal=0;startSize=30;', 30, 0, 370, 200)
      + cell('c', 'pool', `swimlane;startSize=20;${ROLE_KEY}=container;`, 40, 20, 120, 80)
      + cell('n', 'c', 'rounded=0;', 10, 30, 60, 30)
      + '</root></mxGraphModel></diagram></mxfile>';
    const { document } = await DIAGRAM_DRAW_XML.read!(text);
    const containers = asGraph(document.pages[0]!).data.containers ?? [];
    expect(containers.find((c) => c.id === 'c')).toMatchObject({ role: 'container', members: ['n'] });
    expect(containers.find((c) => c.id === 'pool')).toMatchObject({ role: 'pool', lanes: [{ id: 'L' }] });
  });
});
