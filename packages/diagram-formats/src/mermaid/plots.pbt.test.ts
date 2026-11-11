import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { JourneyData, PacketData, PlotData, QuadrantData, RadarData, XyChartData } from '@weasel-js/plot';
import { outcome, runs, timeoutFor } from '../pbt.fixture';
import { CHARTS, journey, packet, quadrant, radar, xychart } from './plots.fixture';
import type { DiagramDocument, ImportResult, PlotPage } from '../document';
import { DIAGRAM_MERMAID } from './format';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 20);

const docOf = (data: PlotData): DiagramDocument => ({ pages: [{ kind: 'plot', id: 'p', width: 800, height: 500, data }] });
const write = (doc: DiagramDocument) => DIAGRAM_MERMAID.write!(doc).text;
const read = (text: string) => (DIAGRAM_MERMAID.read!(text) as ImportResult).document;
const back = (data: PlotData) => (read(write(docOf(data))).pages[0] as PlotPage).data;


/** Text as a line-oriented kind reads it back: its lines joined by spaces, trimmed. */
const flat = (t: string) => t.split(/\r\n?|\n|\u2028|\u2029/).map((l) => l.trim()).filter((l) => l !== '').join(' ');

describe('Mermaid charts beyond pie, sankey, and timeline, property', () => {
  for (const [kind, chart] of Object.entries(CHARTS)) {
    it(`writes any ${kind} as text it reads back as a ${kind}, and writing is a fixed point after one read`, () => {
      fc.assert(fc.property(chart, (data) => {
        const first = outcome(() => write(docOf(data)));
        if ('error' in first) throw new Error(`writing threw: ${first.error}`);
        const page = read(first.value).pages[0] as PlotPage;
        expect(page.data.kind).toBe(kind);
        const once = write(read(first.value));
        expect(write(read(once))).toBe(once);
      }), RUNS);
    }, TIMEOUT);
  }

  it('reads back an xychart\'s series values and kinds, and a range axis\'s ends', () => {
    fc.assert(fc.property(xychart, (data) => {
      const p = back(data) as XyChartData;
      expect(p.series.map((s) => [s.kind, s.values])).toEqual(data.series.map((s) => [s.kind, s.values]));
      if (data.x?.kind === 'range') expect(p.x).toMatchObject({ kind: 'range', min: data.x.min, max: data.x.max });
      expect(p.orientation === 'horizontal').toBe(data.orientation === 'horizontal');
    }), RUNS);
  }, TIMEOUT);

  it('reads back a quadrant chart\'s points where they were', () => {
    fc.assert(fc.property(quadrant, (data) => {
      const p = back(data) as QuadrantData;
      expect(p.points.map((q) => [q.x, q.y])).toEqual(data.points.map((q) => [q.x, q.y]));
    }), RUNS);
  }, TIMEOUT);

  it('reads back a radar\'s axes and each curve\'s values', () => {
    fc.assert(fc.property(radar, (data) => {
      const p = back(data) as RadarData;
      expect(p.axes.map((a) => a.id)).toEqual(data.axes.map((a) => a.id));
      expect(p.curves.map((c) => [c.id, c.values])).toEqual(data.curves.map((c) => [c.id, c.values]));
    }), RUNS);
  }, TIMEOUT);

  it('reads back a journey\'s sections, steps, and scores', () => {
    fc.assert(fc.property(journey, (data) => {
      const p = back(data) as JourneyData;
      // A step named for a statement is dropped, as Mermaid would read it as that statement.
      const kept = (name: string) => !/^(?:title|section)(?:\s|$)/.test(flat(name).replace(/[#:;]/g, '').trim().replace(/^(?:%%+\s*)+/, ''));
      expect(p.sections.map((s) => s.tasks.map((t) => t.score))).toEqual(
        data.sections.map((s) => s.tasks.filter((t) => kept(t.name)).map((t) => t.score)),
      );
    }), RUNS);
  }, TIMEOUT);

  it('reads back a packet\'s fields, bits and labels, a field with no label as the gap Mermaid writes the same way', () => {
    fc.assert(fc.property(packet, (data) => {
      const p = back(data) as PacketData;
      expect(p.fields.map((f) => [f.start, f.end, f.label])).toEqual(data.fields.filter((f) => f.label !== '').map((f) => [f.start, f.end, f.label]));
    }), RUNS);
  }, TIMEOUT);

  it('reads back a title broken across lines as one line, its words kept', () => {
    const tally = { broken: 0 };
    fc.assert(fc.property(fc.oneof(...Object.values(CHARTS)), (data) => {
      if (data.title === undefined || flat(data.title) === '') return;
      if (/[\r\n\u2028\u2029]/.test(data.title)) tally.broken++;
      const t = back(data).title;
      expect(t === undefined ? '' : flat(t), JSON.stringify(data.title)).toBe(
        data.kind === 'journey' ? flat(data.title.replace(/[#;]/g, '')) : flat(data.title),
      );
    }), RUNS);
    expect(tally.broken).toBeGreaterThan(0);
  }, TIMEOUT);
});
