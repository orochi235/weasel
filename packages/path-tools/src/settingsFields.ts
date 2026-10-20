import type { ActionSettingsState } from '@weasel-js/routing';

/**
 * A settings form's values gathered across a selection: each field holds the
 * value every selected item shares, and a field they disagree on is mixed.
 * Paths are dotted one level deep, a section and its field.
 */
export class SettingsFields {
  private readonly values: Record<string, unknown> = {};
  private readonly mixed = new Set<string>();
  private readonly seen = new Map<string, unknown>();

  add(path: string, value: unknown): void {
    if (!this.seen.has(path)) {
      this.seen.set(path, value);
      const dot = path.indexOf('.');
      if (dot < 0) this.values[path] = value;
      else ((this.values[path.slice(0, dot)] ??= {}) as Record<string, unknown>)[path.slice(dot + 1)] = value;
    } else if (this.seen.get(path) !== value) {
      this.mixed.add(path);
    }
  }

  /** The form's state, with `extra` top-level values beside the gathered ones. */
  state(extra: Record<string, unknown> = {}): ActionSettingsState {
    return { values: { ...this.values, ...extra }, mixed: [...this.mixed] };
  }
}
