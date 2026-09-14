import { LabShell, ToolbarRegion, type LabContribution } from '@weasel-js/labkit';
import { fullSelection, type Selection, type ThemeDefinition } from '@weasel-js/theme';
import type { Lookup } from '@weasel-js/theme/engine';
import { Button, Dialog, ExportIcon, RedoIcon, Select, UndoIcon } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayerRail } from './LayerRail';
import { RampsLayer } from './layers/RampsLayer';
import { ScalesLayer } from './layers/ScalesLayer';
import { SemanticsLayer } from './layers/SemanticsLayer';
import styles from './ThemeEditor.module.css';
import { ThemePreview, type PreviewVariant } from './ThemePreview';
import { TokenList } from './TokenList';
import type { ThemeApi } from './theme/api';
import { deriveDraft, type DerivedDraft } from './theme/draft';
import { clearDraft, persistDraft, type StoredDraft } from './theme/draftStorage';
import { EXPORTS, download, exportFile } from './theme/exportFiles';
import { describeIssue } from './theme/issues';
import { documentSheets, tokensReadAt } from './theme/inspect';
import { LAYERS, adoptGenerated, countTokens, pinApplies, runtimeTheme, type LayerId } from './theme/model';
import { layerRows } from './theme/rows';
import type { IssueReport, PutResult, StoredTheme } from './theme/store';
import { useLabHistory, type LabHistory } from './useLabHistory';

export interface WorkbenchProps {
  readonly api: ThemeApi;
  readonly themes: readonly StoredTheme[];
  readonly stored: StoredTheme;
  /** Read once, at mount: a restored draft, or the stored definition. */
  readonly start: StoredDraft;
  readonly onPick: (name: string) => void;
  readonly onSaved: (stored: StoredTheme) => void;
  readonly onReload: () => Promise<void>;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const selectionText = (s: Selection) => Object.values(s).join(', ') || 'every selection';

function IssueList({ title, issues }: { title: string; issues: readonly IssueReport[] }) {
  return (
    <div className={styles.status}>
      <p className={styles.statusTitle}>{title}</p>
      <ul className={styles.issues}>
        {issues.map((r, i) => (
          <li key={i}>
            <code>{selectionText(r.selection)}</code> {describeIssue(r.issue)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveReport({ report, onReload, onDismiss }: { report: PutResult; onReload: () => void; onDismiss: () => void }) {
  if (report.status === 'conflict') {
    return (
      <div className={styles.status}>
        <p>
          <strong>The file changed on disk since this draft began.</strong> Saving would overwrite that change.
        </p>
        <div className={styles.statusActions}>
          <Button size="sm" onClick={onReload}>Reload from disk</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>Keep editing</Button>
        </div>
      </div>
    );
  }
  if (report.status === 'invalid') return <p className={styles.status}>{report.message}</p>;
  return (
    <>
      <p className={styles.status}>
        Saved.{report.regenerated ? ' The generated token files were rewritten.' : ''}
        {report.problems.length > 0 ? ` The generated token files were left alone: ${report.problems.length} problem(s) across the themes.` : ''}
      </p>
      {report.issues.length > 0 && <IssueList title="Saved with issues" issues={report.issues} />}
    </>
  );
}

export function ThemeWorkbench({ api, themes, stored, start, onPick, onSaved, onReload }: WorkbenchProps) {
  const history = useLabHistory<ThemeDefinition>(start.definition);
  const { state: draft, canUndo, canRedo } = history;
  const [saved, setSaved] = useState<ThemeDefinition>(() => (sameJson(start.definition, stored.definition) ? start.definition : stored.definition));
  const [baseHash, setBaseHash] = useState(start.baseHash);
  const [report, setReport] = useState<PutResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [layer, setLayer] = useState<LayerId>('ramps');
  const [axisValues, setAxisValues] = useState<Selection>({});
  const [highlight, setHighlight] = useState<readonly string[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [reads, setReads] = useState<readonly string[]>([]);
  const [focusRamp, setFocusRamp] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const dirty = draft !== saved && !sameJson(draft, saved);

  // Save disables itself on click, which would drop keyboard focus to the body.
  useEffect(() => {
    if (report) statusRef.current?.focus();
  }, [report]);

  const reload = async () => {
    setReloadError(null);
    try {
      await onReload();
    } catch (e) {
      setReloadError(`Couldn't reload ${stored.name} from disk: ${(e as Error).message}`);
    }
  };

  useEffect(() => {
    if (dirty) persistDraft({ definition: draft, baseHash });
    else clearDraft(draft.name);
  }, [dirty, draft, baseHash]);

  const lookup = useMemo<Lookup>(() => {
    const byName = new Map(themes.map((t) => [t.name, t.definition]));
    byName.set(draft.name, draft);
    return (name) => byName.get(name);
  }, [themes, draft]);

  // A draft mid-edit can fail to derive (a reference typed half-way); the editor keeps showing the last one that did.
  const lastGood = useRef<DerivedDraft | null>(null);
  const { derived, error } = useMemo(() => {
    try {
      const next = deriveDraft(draft, lookup, axisValues);
      lastGood.current = next;
      return { derived: next, error: null };
    } catch (e) {
      return { derived: lastGood.current, error: (e as Error).message };
    }
  }, [draft, lookup, axisValues]);

  const contributions = useMemo<readonly LabContribution<LabHistory<ThemeDefinition>>[]>(
    () => [
      { id: 'undo', group: 'history', region: 'header', item: { icon: UndoIcon, label: 'Undo', shortcut: '⌘Z', disabled: !canUndo, onActivate: (h) => h.undo() } },
      { id: 'redo', group: 'history', region: 'header', item: { icon: RedoIcon, label: 'Redo', shortcut: '⇧⌘Z', disabled: !canRedo, onActivate: (h) => h.redo() } },
      { id: 'export', region: 'header', item: { icon: ExportIcon, label: 'Export', showLabel: true, onActivate: () => setExporting(true) } },
    ],
    [canUndo, canRedo],
  );

  const generatedTheme = useMemo(
    () => (focusRamp === null ? null : runtimeTheme(adoptGenerated(draft, lookup, focusRamp), lookup, `draft-${draft.name}-generated`)),
    [focusRamp, draft, lookup],
  );

  if (!derived) {
    return (
      <LabShell title="Theme editor">
        <div role="alert" className={styles.status}>
          <p>
            {stored.name} does not derive: {error}
          </p>
          <div className={styles.statusActions}>
            <Button size="sm" onClick={reload}>Discard the draft and reload from disk</Button>
          </div>
        </div>
        {reloadError && <p role="status" className={styles.status}>{reloadError}</p>}
      </LabShell>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.put(draft.name, draft, baseHash);
      setReport(result);
      if (result.status === 'saved') {
        setSaved(draft);
        setBaseHash(result.hash);
        onSaved({ ...stored, hash: result.hash, definition: draft });
      }
    } catch (e) {
      setReport({ status: 'invalid', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const counts = countTokens(draft, derived.primary.result);
  // A pinned token jumps to Pins: the pin is what decides its value.
  const layerOf = (token: string): LayerId =>
    pinApplies(derived.primary.result, token) ? 'pins' : (derived.primary.result.provenance[token]?.layer ?? 'pins');
  const jump = (tokens: readonly string[]) => {
    if (tokens.length === 0) return;
    setLayer(layerOf(tokens[0]));
    setHighlight(tokens);
  };
  const inspect = (target: Element, pane: Element) => {
    const known = tokensReadAt(target, pane, documentSheets()).filter((t) => Object.hasOwn(derived.primary.result.tokens, t));
    setReads(known);
    jump(known);
  };
  const liveIssues: IssueReport[] = derived.views.flatMap((v) => v.result.issues.map((issue) => ({ selection: v.selection, issue })));
  const layerLabel = LAYERS.find((l) => l.id === layer)!.label;
  const previewVariants: readonly PreviewVariant[] = generatedTheme
    ? [{ label: 'Pinned', theme: derived.theme }, { label: `Generated ${focusRamp}`, theme: generatedTheme }]
    : [{ label: 'Draft', theme: derived.theme }];

  const layerEditor = (() => {
    switch (layer) {
      case 'ramps':
        return <RampsLayer draft={draft} derived={derived} lookup={lookup} highlight={highlight} focused={focusRamp} onFocus={setFocusRamp} onChange={history.update} />;
      case 'scales':
        return <ScalesLayer draft={draft} derived={derived} lookup={lookup} highlight={highlight} onChange={history.update} />;
      case 'semantics':
        return <SemanticsLayer draft={draft} derived={derived} lookup={lookup} highlight={highlight} onChange={history.update} />;
      default:
        return <TokenList rows={layerRows(layer, draft, derived.primary.result)} highlight={highlight} empty={`${draft.name} has no ${layerLabel.toLowerCase()}.`} />;
    }
  })();

  const header = (
    <div className={styles.header}>
      <Select aria-label="Theme" width="fit" options={themes.map((t) => ({ value: t.name, label: t.name }))} selectedKey={stored.name} onSelectionChange={onPick} />
      {Object.entries(derived.axes)
        .filter(([axis]) => axis !== 'mode')
        .map(([axis, def]) => (
          <Select
            key={axis}
            aria-label={axis}
            width="fit"
            options={Object.keys(def.values).map((v) => ({ value: v, label: `${axis}: ${v}` }))}
            selectedKey={fullSelection(derived.axes, axisValues)[axis]}
            onSelectionChange={(v) => setAxisValues((s) => ({ ...s, [axis]: v }))}
          />
        ))}
      <span className={styles.overridden}>
        {counts.overridden} of {counts.total} overridden
      </span>
      <ToolbarRegion region="header" label="Theme actions" contributions={contributions} ctx={history} />
      <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={save} ariaLabel={dirty ? 'Save, with unsaved changes' : 'Save'}>
        {dirty && <span className={styles.dirtyDot} aria-hidden="true" />}
        Save
      </Button>
    </div>
  );

  return (
    <LabShell title="Theme editor" header={header}>
      <div className={styles.workbench}>
        <LayerRail counts={counts.layers} selected={layer} onSelect={setLayer} />
        <section className={styles.editor} aria-label={`${layerLabel} layer`}>
          {(report || reloadError) && (
            <div ref={statusRef} role="status" tabIndex={-1} className={styles.statusStack}>
              {reloadError && <p className={styles.status}>{reloadError}</p>}
              {report && <SaveReport report={report} onReload={reload} onDismiss={() => setReport(null)} />}
            </div>
          )}
          {error && (
            <p role="status" className={styles.status}>
              This draft does not derive: {error}. The preview shows the last version that did.
            </p>
          )}
          {liveIssues.length > 0 && <IssueList title="Issues" issues={liveIssues} />}
          {layerEditor}
        </section>
        <aside className={styles.previewColumn} aria-label="Preview">
          <div className={styles.previewBar}>
            <Button size="sm" pressed={inspecting} onClick={() => setInspecting((on) => !on)}>
              Inspect
            </Button>
            {inspecting && reads.length === 0 && <span className={styles.metric}>Click a component to see the tokens it reads.</span>}
            {reads.length > 0 && (
              <ul className={styles.reads} aria-label="Tokens read">
                {reads.map((t) => (
                  <li key={t}>
                    <button type="button" className={styles.linkButton} onClick={() => jump([t])}>
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ThemePreview variants={previewVariants} selection={axisValues} inspecting={inspecting} onInspect={inspect} />
        </aside>
      </div>
      <Dialog isOpen={exporting} onOpenChange={setExporting} title={`Export ${draft.name}`} footer={<Button onClick={() => setExporting(false)}>Done</Button>}>
        <p>The draft as it stands, saved or not.</p>
        <div className={styles.statusActions}>
          {EXPORTS.map(({ kind, label }) => (
            <Button key={kind} size="sm" onClick={() => download(exportFile(kind, draft, lookup))}>
              {label}
            </Button>
          ))}
        </div>
      </Dialog>
    </LabShell>
  );
}
