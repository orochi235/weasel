import { useToolOptionParams } from '@weasel-js/core';
import { setToolOption } from '@weasel-js/routing';
import { ToolOptionsBar } from '@weasel-js/ui/components/ToolOptionsBar';
import { useDeferredValue, useRef } from 'react';
import { useLabChromeContext } from '../chrome/LabChrome';
import { PersistedFloatingPanel } from '../primitives/PersistedFloatingPanel';
import type { TrialTool } from '../tools/types';
import { GESTURE_MS } from '../trial/writeGesture';
import { useLabMarkStores } from './labMarkStores';
import { type MarkStyleField, markHasField, selectionStyle } from './selectionStyle';
import type { Annotation, AnnotationsApi } from './types';
import { useLabToolOptionValues } from './useLabToolOptions';

/** Props for `<AnnotationOptions>`. */
export interface AnnotationOptionsProps {
  /** The lab's tools, annotation tools included: the active one's options are drawn. */
  tools: readonly TrialTool[];
}

interface Selected {
  store: AnnotationsApi;
  mark: Annotation;
}

function selectedMarks(stores: readonly AnnotationsApi[]): Selected[] {
  const out: Selected[] = [];
  for (const store of stores) {
    for (const id of store.selection()) {
      const mark = store.get(id);
      if (mark) out.push({ store, mark });
    }
  }
  return out;
}

/** One undo step per burst of edits to one field of one selection, as a trial's config writes are. */
function useRestyleGesture(): (field: string, ids: string) => string {
  const last = useRef<{ field: string; ids: string; at: number; n: number } | null>(null);
  return (field, ids) => {
    const now = Date.now();
    const prev = last.current;
    const gap = prev ? now - prev.at : Infinity;
    const same =
      prev !== null && prev.field === field && prev.ids === ids && gap >= 0 && gap < GESTURE_MS;
    const n = same && prev ? prev.n : (prev?.n ?? 0) + 1;
    last.current = { field, ids, at: now, n };
    return `restyle:${n}`;
  };
}

/**
 * The lab's floating options palette. With a tool that declares options, it draws them: the style the next mark is
 * drawn in. With Select and marks selected, in any trial, it draws their style and restyles them. Otherwise it is
 * not there.
 */
export function AnnotationOptions({ tools }: AnnotationOptionsProps) {
  const { activeToolId } = useLabChromeContext();
  const values = useLabToolOptionValues();
  const stores = useLabMarkStores();
  const tool = tools.find((t) => t.id === activeToolId);
  const options = tool?.options;
  const params = useToolOptionParams(options && tool, values);
  const gesture = useRestyleGesture();

  const bar =
    tool && options && params
      ? {
          label: tool.label,
          schema: options.prefs,
          values: params,
          onChange: (path: string, value: unknown) =>
            setToolOption(tool.id, options, values, path, value),
        }
      : selectionBar(activeToolId === 'select' ? selectedMarks(stores) : [], gesture);
  // Mounted a render late: a tool or a selection set while a trial lays out arrives inside that layout's
  // ResizeObserver callback, and the panel's own observer begun there is reported as a loop.
  const shown = useDeferredValue(bar !== null);
  if (!bar || !shown) return null;
  return (
    <PersistedFloatingPanel
      className="lk-annotation-options"
      anchor="bottom-right"
      persist="annotation-options"
    >
      <ToolOptionsBar {...bar} />
    </PersistedFloatingPanel>
  );
}

/** The bar for Select's selection: its marks' style, restyling every mark that has the field edited. */
function selectionBar(selected: Selected[], gesture: (field: string, ids: string) => string) {
  const style = selectionStyle(selected.map((s) => s.mark));
  if (!style) return null;
  const ids = selected.map((s) => s.mark.id).join(' ');
  return {
    label: selected.length === 1 ? 'Mark' : `${selected.length} marks`,
    schema: style.schema,
    values: style.values,
    mixed: style.mixed,
    onChange: (path: string, value: unknown) => {
      const field = path as MarkStyleField;
      const coalesceKey = gesture(field, ids);
      for (const { store, mark } of selected) {
        if (markHasField(mark.kind, field))
          store.update(mark.id, { [field]: value }, { coalesceKey });
      }
    },
  };
}
