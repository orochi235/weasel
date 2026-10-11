import type { AxisDefs } from '../axes.ts';
import type { Issue } from './types.ts';

/** What is wrong with the axes themselves: one with no values has no selection to derive at, and a default outside the values names tokens nothing declares. */
export function axisIssues(axes: AxisDefs): Issue[] {
  const issues: Issue[] = [];
  for (const [name, def] of Object.entries(axes)) {
    const values = Object.keys(def.values ?? {});
    if (values.length === 0) {
      issues.push({ kind: 'invalid', path: `axes.${name}`, message: `axis "${name}" has no values` });
    } else if (!values.includes(def.default)) {
      issues.push({ kind: 'invalid', path: `axes.${name}`, message: `axis "${name}" defaults to "${def.default}", which is not one of its values (${values.join(', ')})` });
    }
  }
  return issues;
}
