/** Each chart kind's data as a schema of fields and tables, and the walks a host makes over one. */
import { ganttSchema } from '../gantt/schema';
import { gitgraphSchema } from '../gitgraph/schema';
import { journeySchema } from '../journey/schema';
import { packetSchema } from '../packet/schema';
import { pieSchema } from '../pie/schema';
import type { PlotData, PlotKind } from '../plotData';
import { quadrantSchema } from '../quadrant/schema';
import { radarSchema } from '../radar/schema';
import { sankeySchema } from '../sankey/schema';
import { timelineSchema } from '../timeline/schema';
import { xySchema } from '../xychart/schema';
import type { PlotSchema, PlotScope, PlotTable } from './schemaTypes';

const SCHEMAS: { readonly [K in PlotKind]: PlotSchema<Extract<PlotData, { kind: K }>> } = {
  xychart: xySchema,
  gantt: ganttSchema,
  timeline: timelineSchema,
  pie: pieSchema,
  quadrant: quadrantSchema,
  journey: journeySchema,
  gitgraph: gitgraphSchema,
  sankey: sankeySchema,
  packet: packetSchema,
  radar: radarSchema,
};

/** `data`'s kind as fields and tables. Throws on a kind with none. */
export function plotSchemaOf(data: PlotData): PlotSchema {
  const schema = SCHEMAS[data.kind] as PlotSchema | undefined;
  if (schema === undefined) throw new Error(`plotSchemaOf: no schema for a chart of kind "${(data as { kind: string }).kind}"`);
  return schema;
}

/** Every table in `schema` with the scope of each place it appears in `data`, outermost first: a nested table once
 *  under each row of its parent. */
export function plotTablesIn(schema: PlotSchema, data: PlotData): { table: PlotTable; scope: PlotScope }[] {
  const out: { table: PlotTable; scope: PlotScope }[] = [];
  const walk = (tables: readonly PlotTable[], scope: PlotScope) => {
    for (const table of tables) {
      out.push({ table, scope });
      if (table.children === undefined) continue;
      for (let r = 0; r < table.count(data, scope); r++) walk(table.children, [...scope, r]);
    }
  };
  walk(schema.tables, []);
  return out;
}
