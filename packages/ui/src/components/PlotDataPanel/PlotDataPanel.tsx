import { plotSchemaOf, type PlotData, type PlotValue } from '@weasel-js/plot';
import { useState, type ReactElement } from 'react';
import { PropertyField, PropertyList, PropertyNote, PropertyPanel, Subpanel } from '../Properties';
import { PlotTableView } from './PlotTableView';
import { valueControl } from './valueControl';

/** Props for {@link PlotDataPanel}. */
export interface PlotDataPanelProps {
  /** The chart, any kind. */
  data: PlotData;
  /** The chart as an edit leaves it, and a name for the edit, for an undo entry. The panel holds no copy: show the
   *  change by passing it back as `data`. */
  onChange: (next: PlotData, label: string) => void;
  /** Default `'Data'`. */
  title?: string;
  className?: string;
}

/**
 * Authors a chart's data, whatever its kind, from the kind's schema (`plotSchemaOf`): a row per field, and a grid
 * per table whose rows can be added, removed, reordered, and opened onto the tables they hold.
 */
export function PlotDataPanel({ data, onChange, title = 'Data', className }: PlotDataPanelProps): ReactElement {
  const [error, setError] = useState<string | null>(null);
  const schema = plotSchemaOf(data);
  const edit = (change: (d: PlotData) => PlotData, label: string) => {
    try {
      const next = change(data);
      setError(null);
      if (next !== data) onChange(next, label);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const fields = schema.fields.filter((f) => f.applies?.(data) !== false);
  return (
    <PropertyPanel title={title} className={className}>
      <PropertyList>
        {fields.map((field) => {
          const set = (value: PlotValue) => edit((d) => field.set(d, value), `Edit ${field.label.toLowerCase()}`);
          const control = valueControl({ ...field, value: field.get(data) }, field.label, set);
          return <PropertyField key={field.key} label={field.label} {...control} />;
        })}
        {error !== null && <PropertyNote>{error}</PropertyNote>}
      </PropertyList>
      {schema.tables.map((table) => (
        <Subpanel key={table.key} title={table.label}>
          <PlotTableView data={data} table={table} scope={[]} edit={edit} />
        </Subpanel>
      ))}
    </PropertyPanel>
  );
}
