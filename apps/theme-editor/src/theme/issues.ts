import type { Issue } from '@weasel-js/theme/engine';

export function describeIssue(issue: Issue): string {
  switch (issue.kind) {
    case 'missing-axis-value':
      return `${issue.path} has no value for ${issue.axis}=${issue.value}`;
    case 'untyped-pin':
      return `${issue.token} needs a type`;
    case 'infeasible-ramp':
      return `no arrangement of ${issue.ramp} meets its gates`;
    case 'contrast-unmet':
      return `${issue.token}: no step reaches ${issue.min}:1 against ${issue.against.join(', ')}; using ${issue.picked} at ${issue.ratio.toFixed(2)}:1`;
    case 'check-failed':
      return `${issue.token} reaches ${issue.ratio.toFixed(2)}:1 against ${issue.against}, under ${issue.min}:1`;
    case 'invalid':
      return `${issue.path}: ${issue.message}`;
  }
}
