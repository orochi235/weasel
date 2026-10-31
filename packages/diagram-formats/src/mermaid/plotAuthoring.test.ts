/** Charts authored from nothing through `@weasel-js/plot`'s structural edits write to Mermaid and read back equal. */
import {
  insertGanttSection, insertGanttTask, insertGitCommand, insertJourneySection, insertJourneyTask, insertPacketField, insertPieSlice,
  insertQuadrantClass, insertQuadrantPoint, insertRadarAxis, insertRadarCurve, insertSankeyLink, insertTimelineEvent, insertTimelinePeriod,
  insertTimelineSection, insertXyRow, insertXySeries, setGanttTaskId, setGanttTaskStart, setGanttTaskTags, setGitCommandField,
  setGitCommandKind, setJourneyActors, setPacketBits, setPieShowData, setQuadrantPoint, setQuadrantPointClass, setRadarValue, setSankeyEnd,
  setXyAxisTitle, setXyCategory, setXySeriesKind, setXyValue, setXyValueBound, withTitle, type GanttData, type GitGraphData, type JourneyData, type PacketData, type PieData, type PlotData,
  type QuadrantData, type RadarData, type SankeyData, type TimelineData, type XyChartData,
} from '@weasel-js/plot';
import { describe, expect, it } from 'vitest';
import type { ExportResult, ImportResult, PlotPage } from '../document';
import { readMermaidGantt } from './gantt/read';
import { writeMermaidGantt } from './gantt/write';
import { readMermaidGitGraph } from './gitgraph/read';
import { writeMermaidGitGraph } from './gitgraph/write';
import { readMermaidJourney } from './journey/read';
import { writeMermaidJourney } from './journey/write';
import { readMermaidPacket } from './packet/read';
import { writeMermaidPacket } from './packet/write';
import { readMermaidPie } from './pie/read';
import { writeMermaidPie } from './pie/write';
import { readMermaidQuadrant } from './quadrant/read';
import { writeMermaidQuadrant } from './quadrant/write';
import { readMermaidRadar } from './radar/read';
import { writeMermaidRadar } from './radar/write';
import { readMermaidSankey } from './sankey/read';
import { writeMermaidSankey } from './sankey/write';
import { readMermaidTimeline } from './timeline/read';
import { writeMermaidTimeline } from './timeline/write';
import { readMermaidXychart } from './xychart/read';
import { writeMermaidXychart } from './xychart/write';

/** `fns` applied in order to `start`. */
const build = <D extends PlotData>(start: D, ...fns: ((d: D) => D)[]): D => fns.reduce((d, f) => f(d), start);

/** `data` written and read back, with the warnings each way. */
function roundTrip(data: PlotData, write: (p: PlotPage) => ExportResult, read: (t: string) => ImportResult) {
  const written = write({ kind: 'plot', id: 'p', width: 640, height: 400, data });
  const back = read(written.text);
  return { data: (back.document.pages[0] as PlotPage).data, warnings: [...written.warnings, ...back.warnings], text: written.text };
}

const CASES: { name: string; data: PlotData; write: (p: PlotPage) => ExportResult; read: (t: string) => ImportResult }[] = [
  {
    name: 'pie',
    data: build<PieData>({ kind: 'pie', slices: [] }, (d) => insertPieSlice(d, 0), (d) => insertPieSlice(d, 1), (d) => setPieShowData(d, true), (d) => withTitle(d, 'Pets')),
    write: writeMermaidPie, read: readMermaidPie,
  },
  {
    name: 'xychart',
    data: build(
      { kind: 'xychart', series: [] } as XyChartData, (d) => insertXySeries(d, 0), (d) => insertXyRow(d, 0), (d) => insertXyRow(d, 1), (d) => setXyCategory(d, 0, 'Jan'),
      (d) => setXyValue(d, 0, 1, 4), (d) => insertXySeries(d, 1), (d) => setXySeriesKind(d, 1, 'line'), (d) => setXyAxisTitle(d, 'y', 'Sales'),
      (d) => setXyValueBound(setXyValueBound(d, 'min', 0), 'max', 10), (d) => withTitle(d, 'Sales'),
    ),
    write: writeMermaidXychart, read: readMermaidXychart,
  },
  {
    name: 'gantt',
    data: build(
      { kind: 'gantt', sections: [] } as GanttData, (d) => insertGanttSection(d, 0), (d) => setGanttTaskStart(d, 0, 0, { kind: 'date', date: '2024-01-01' }),
      (d) => setGanttTaskId(d, 0, 0, 't1'), (d) => insertGanttSection(d, 1), (d) => insertGanttTask(d, 1, 1),
      (d) => setGanttTaskStart(d, 1, 0, { kind: 'after', ids: ['t1'] }), (d) => setGanttTaskTags(d, 1, 1, ['crit', 'done']),
    ),
    write: writeMermaidGantt, read: readMermaidGantt,
  },
  {
    name: 'timeline',
    data: build(
      { kind: 'timeline', sections: [] } as TimelineData, (d) => insertTimelineSection(d, 0), (d) => insertTimelineEvent(d, 0, 0, 0),
      (d) => insertTimelinePeriod(d, 0, 1), (d) => insertTimelineEvent(insertTimelineEvent(d, 0, 1, 0), 0, 1, 1), (d) => withTitle(d, 'History'),
    ),
    write: writeMermaidTimeline, read: readMermaidTimeline,
  },
  {
    name: 'quadrant',
    data: build(
      { kind: 'quadrant', points: [] } as QuadrantData, (d) => insertQuadrantPoint(d, 0), (d) => insertQuadrantPoint(d, 1),
      (d) => setQuadrantPoint(d, 1, { x: 0.25, y: 0.75 }), (d) => insertQuadrantClass(d, 0), (d) => setQuadrantPointClass(d, 0, 'class1'),
    ),
    write: writeMermaidQuadrant, read: readMermaidQuadrant,
  },
  {
    name: 'journey',
    data: build(
      { kind: 'journey', sections: [] } as JourneyData, (d) => insertJourneySection(d, 0), (d) => insertJourneyTask(d, 0, 1),
      (d) => setJourneyActors(d, 0, 0, ['Me', 'Cat']), (d) => insertJourneySection(d, 1), (d) => withTitle(d, 'My day'),
    ),
    write: writeMermaidJourney, read: readMermaidJourney,
  },
  {
    name: 'gitgraph',
    data: build(
      { kind: 'gitgraph', commands: [] } as GitGraphData, (d) => insertGitCommand(d, 0), (d) => insertGitCommand(d, 1), (d) => setGitCommandKind(d, 1, 'branch'),
      (d) => insertGitCommand(d, 2), (d) => setGitCommandField(d, 2, 'tag', 'v1'), (d) => insertGitCommand(d, 3),
      (d) => setGitCommandKind(d, 3, 'checkout'), (d) => insertGitCommand(d, 4), (d) => setGitCommandKind(d, 4, 'merge'),
    ),
    write: writeMermaidGitGraph, read: readMermaidGitGraph,
  },
  {
    name: 'sankey',
    data: build(
      { kind: 'sankey', links: [] } as SankeyData, (d) => insertSankeyLink(d, 0), (d) => insertSankeyLink(d, 1), (d) => insertSankeyLink(d, 2),
      (d) => setSankeyEnd(d, 2, 'source', 'Node 1'),
    ),
    write: writeMermaidSankey, read: readMermaidSankey,
  },
  {
    name: 'packet',
    data: build(
      { kind: 'packet', fields: [] } as PacketData, (d) => insertPacketField(d, 0), (d) => insertPacketField(d, 1), (d) => setPacketBits(d, 1, 16),
      (d) => insertPacketField(d, 1), (d) => withTitle(d, 'Header'),
    ),
    write: writeMermaidPacket, read: readMermaidPacket,
  },
  {
    name: 'radar',
    data: build(
      { kind: 'radar', axes: [], curves: [] } as RadarData, (d) => insertRadarAxis(d, 0), (d) => insertRadarAxis(d, 1), (d) => insertRadarAxis(d, 2),
      (d) => insertRadarCurve(d, 0), (d) => setRadarValue(d, 0, 1, 3), (d) => insertRadarCurve(d, 1), (d) => setRadarValue(d, 1, 2, 5),
    ),
    write: writeMermaidRadar, read: readMermaidRadar,
  },
];

describe('a chart authored from nothing', () => {
  for (const c of CASES) {
    it(`writes a ${c.name} to Mermaid and reads it back equal`, () => {
      const back = roundTrip(c.data, c.write, c.read);
      expect(back.warnings).toEqual([]);
      expect(back.data).toEqual(c.data);
    });
  }
});
