import { isPlainObject } from '@weasel-js/registry';
import { axisNameProblem, axisValueProblem, type AxisDefs } from '../axes.ts';
import type { Issue } from './types.ts';

/** What is wrong with the axes themselves: one with no values has no selection to derive at, and a default outside the values names tokens nothing declares. */
export function axisIssues(axes: AxisDefs): Issue[] {
  const issues: Issue[] = [];
  for (const [name, def] of Object.entries(axes)) {
    const problem = axisNameProblem(name);
    if (problem || !isPlainObject(def)) {
      issues.push({ kind: 'invalid', path: `axes.${name}`, message: problem ?? `axis "${name}" must be an object with values and a default` });
      continue;
    }
    const entries = isPlainObject(def.values) ? def.values : {};
    const values = Object.keys(entries);
    for (const [value, entry] of Object.entries(entries)) {
      const bad = axisValueProblem(value, entry);
      if (bad) issues.push({ kind: 'invalid', path: `axes.${name}.values.${value}`, message: `axis "${name}": ${bad}` });
    }
    if (values.length === 0) {
      issues.push({ kind: 'invalid', path: `axes.${name}`, message: `axis "${name}" has no values` });
    } else if (typeof def.default !== 'string') {
      issues.push({ kind: 'invalid', path: `axes.${name}.default`, message: `axis "${name}" needs a default naming one of its values (${values.join(', ')})` });
    } else if (!values.includes(def.default)) {
      issues.push({ kind: 'invalid', path: `axes.${name}`, message: `axis "${name}" defaults to "${def.default}", which is not one of its values (${values.join(', ')})` });
    }
  }
  return issues;
}
