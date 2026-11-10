import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { PieData, PlotData, SankeyData, TimelineData } from '@weasel-js/plot';
import { oddText, runs, timeoutFor } from '../pbt.fixture';
import type { DiagramDocument, ImportResult, PlotPage } from '../document';
import { DIAGRAM_MERMAID } from './format';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 20);

const docOf = (data: PlotData): DiagramDocument => ({ pages: [{ kind: 'plot', id: 'p', width: 800, height: 500, data }] });
const write = (doc: DiagramDocument) => DIAGRAM_MERMAID.write!(doc).text;
const back = (data: PlotData) => ((DIAGRAM_MERMAID.read!(write(docOf(data))) as ImportResult).document.pages[0] as PlotPage).data;

const amount = fc.oneof(fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: 0, max: 100_000 }).map((n) => n / 100));
const title = fc.option(oddText.filter((t) => t.trim() !== ''), { nil: undefined });
const trimmed = (t: string | undefined) => (t === undefined || t.trim() === '' ? undefined : t.trim());

const pie: fc.Arbitrary<PieData> = fc.record({
  title, showData: fc.boolean(),
  slices: fc.uniqueArray(fc.record({ label: oddText, value: amount }), { selector: (s) => s.label, maxLength: 5 }),
}).map(({ title: t, showData, slices }) => ({ kind: 'pie', ...(t !== undefined ? { title: t } : {}), ...(showData ? { showData } : {}), slices }));

const sankey: fc.Arbitrary<SankeyData> = fc.record({
  title, links: fc.array(fc.record({ source: oddText.filter((t) => t !== ''), target: oddText.filter((t) => t !== ''), value: amount }), { maxLength: 5 }),
}).map(({ title: t, links }) => ({ kind: 'sankey', ...(t !== undefined ? { title: t } : {}), links }));

const timeline: fc.Arbitrary<TimelineData> = fc.record({
  title,
  sections: fc.array(fc.record({
    name: oddText,
    periods: fc.array(fc.record({ label: oddText, events: fc.array(oddText.filter((t) => t.trim() !== ''), { maxLength: 3 }) }), { minLength: 1, maxLength: 3 }),
  }), { minLength: 1, maxLength: 3 }),
}).map(({ title: t, sections }) => ({ kind: 'timeline', ...(t !== undefined ? { title: t } : {}), sections }));

describe('Mermaid charts, property', () => {
  it('reads back a pie: its title, its slices, and whether it shows its data', () => {
    fc.assert(fc.property(pie, (data) => {
      const p = back(data) as PieData;
      expect([p.title, p.showData === true, p.slices.map((s) => [s.label, s.value])]).toEqual(
        [trimmed(data.title), data.showData === true, data.slices.map((s) => [s.label, s.value])],
      );
    }), RUNS);
  }, TIMEOUT);

  it('reads back a sankey\'s title and links', () => {
    fc.assert(fc.property(sankey, (data) => {
      const p = back(data) as SankeyData;
      expect([p.title, p.links]).toEqual([data.title, data.links]);
    }), RUNS);
  }, TIMEOUT);

  it('reads back a timeline\'s title, sections, periods, and events', () => {
    fc.assert(fc.property(timeline, (data) => {
      const p = back(data) as TimelineData;
      expect([p.title, p.sections.map((s) => [s.name, s.periods.map((q) => [q.label, q.events])])]).toEqual([
        trimmed(data.title),
        // A period with no label is dropped, since a line with none adds events to the period above it.
        data.sections.map((s) => [s.name.trim(), s.periods.filter((q) => q.label.trim() !== '').map((q) => [q.label.trim(), q.events.map((e) => e.trim())])]),
      ]);
    }), RUNS);
  }, TIMEOUT);

  it('writes what it read as it was written, for every chart', () => {
    fc.assert(fc.property(fc.oneof(pie, sankey, timeline), (data) => {
      const once = write((DIAGRAM_MERMAID.read!(write(docOf(data))) as ImportResult).document);
      expect(write((DIAGRAM_MERMAID.read!(once) as ImportResult).document)).toBe(once);
    }), RUNS);
  }, TIMEOUT);
});
