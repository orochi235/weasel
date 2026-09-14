import { enumerateSelections, type AxisDefs, type Selection, type ThemeDefinition } from '@weasel-js/theme';
import { axisDependencies, declaredSteps, derive, mergeChain, type Lookup } from '@weasel-js/theme/engine';

export interface ScaleColumn {
  readonly label: string;
  readonly selection: Selection;
  /** Step → value, e.g. `8px`. */
  readonly values: Readonly<Record<string, string>>;
}

export interface ScaleTable {
  readonly steps: readonly string[];
  readonly columns: readonly ScaleColumn[];
}

export function scaleTable(def: ThemeDefinition, lookup: Lookup, scale: string): ScaleTable {
  const merged = mergeChain(def, lookup);
  const entry = merged.scales?.[scale];
  if (!entry) return { steps: [], columns: [] };
  const steps = declaredSteps(entry);
  const deps = axisDependencies(def, lookup);
  const varying = new Set(steps.flatMap((step) => deps[`${scale}-${step}`]?.all ?? []));
  const axes: AxisDefs = Object.fromEntries(Object.entries(merged.axes ?? {}).filter(([axis]) => varying.has(axis)));
  const columns = enumerateSelections(axes).map((selection) => {
    const tokens = derive(def, selection, lookup).tokens;
    const values: Record<string, string> = {};
    for (const step of steps) {
      const token = tokens[`${scale}-${step}`];
      if (token) values[step] = String(token.value);
    }
    const label = Object.entries(selection).map(([axis, value]) => `${axis}=${value}`).join(', ') || 'value';
    return { label, selection, values };
  });
  return { steps, columns };
}
