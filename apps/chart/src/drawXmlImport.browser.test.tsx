/**
 * Importing draw-style XML in a real browser: File › Import… reads a two-page
 * file holding a pool of two lanes, and the chart shows both pages and the pool.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_SCENE_KEY } from './chartPersistence';
import { mountChartApp, unmountChartApp } from './testing/mountChartApp';

registerCanvasFont('sans-serif');

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile>
  <diagram id="intake" name="Intake">
    <mxGraphModel grid="1" gridSize="10" page="1" pageScale="1" pageWidth="850" pageHeight="600">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="ask" value="Ask?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="60" y="60" width="120" height="80" as="geometry" />
        </mxCell>
        <mxCell id="file" value="File it" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;" vertex="1" parent="1">
          <mxGeometry x="300" y="80" width="120" height="40" as="geometry" />
        </mxCell>
        <mxCell id="go" value="yes" style="edgeStyle=orthogonalEdgeStyle;html=1;" edge="1" parent="1" source="ask" target="file">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
  <diagram id="teams" name="Teams">
    <mxGraphModel grid="1" gridSize="10" page="1" pageScale="1" pageWidth="850" pageHeight="600">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="pool" value="Office" style="swimlane;html=1;childLayout=stackLayout;horizontal=0;startSize=20;horizontalStack=0;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="500" height="240" as="geometry" />
        </mxCell>
        <mxCell id="front" value="Front desk" style="swimlane;html=1;startSize=20;horizontal=0;" vertex="1" parent="pool">
          <mxGeometry x="20" width="480" height="120" as="geometry" />
        </mxCell>
        <mxCell id="greet" value="Greet" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="front">
          <mxGeometry x="60" y="30" width="100" height="60" as="geometry" />
        </mxCell>
        <mxCell id="back" value="Back office" style="swimlane;html=1;startSize=20;horizontal=0;" vertex="1" parent="pool">
          <mxGeometry x="20" y="120" width="480" height="120" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

const realClick = HTMLInputElement.prototype.click;

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
  // The file picker is the platform's; hand it the fixture as if the user chose it.
  HTMLInputElement.prototype.click = function click(this: HTMLInputElement): void {
    if (this.type !== 'file') return realClick.call(this);
    const files = new DataTransfer();
    files.items.add(new File([FIXTURE], 'process.xml', { type: 'text/xml' }));
    this.files = files.files;
    this.dispatchEvent(new Event('change'));
  };
});

afterEach(() => {
  HTMLInputElement.prototype.click = realClick;
  unmountChartApp();
  localStorage.clear();
});

interface Saved { nodes: { id: string; parent?: string | null; data: { diagram?: { container?: { role: string } } } }[] }
const saved = (): Saved => JSON.parse(localStorage.getItem(CHART_SCENE_KEY) ?? '{"nodes":[]}') as Saved;
const tabs = () => [...document.querySelectorAll<HTMLElement>('[role="tab"]')].map((t) => t.textContent);
const menuRow = (label: string) => [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')]
  .find((el) => el.textContent?.startsWith(label));

describe('importing draw-style XML', () => {
  it('opens both pages as tabs, with the pool and its lanes on the second', async () => {
    await mountChartApp();
    const file = [...document.querySelectorAll<HTMLElement>('[role="menubar"] [role="menuitem"]')].find((el) => el.textContent === 'File')!;
    await userEvent.click(file);
    await expect.poll(() => menuRow('Import')).toBeDefined();
    await userEvent.click(menuRow('Import')!);

    await expect.poll(tabs).toEqual(['Intake', 'Teams']);
    const roles = (role: string) => saved().nodes.filter((n) => n.data.diagram?.container?.role === role).map((n) => n.id);
    await expect.poll(() => roles('pool')).toEqual(['pool']);
    const nodes = saved().nodes;
    expect(roles('lane').sort()).toEqual(['back', 'front']);
    expect(nodes.find((n) => n.id === 'greet')?.parent).toBe('front');
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['ask', 'file', 'go']));
  });
});
