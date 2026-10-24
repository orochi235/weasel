import {
  type Action,
  type ActionsRegistry,
  createDispatcher,
  type DepRegistry,
  type ResolvedCandidate,
  type Tool,
} from '@weasel-js/core';
import { buildRouteRegistry } from '@weasel-js/core/routing';
import { Badge } from '@weasel-js/ui/components/Badge';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import { Select } from '@weasel-js/ui/components/Select';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { type ReactElement, useMemo, useState } from 'react';
import {
  AFFORDANCE_PREFIX,
  isPredicateTarget,
  KIND_PREFIX,
  RESOLUTION_BODY_TARGETS,
  RESOLUTION_GESTURES,
  type ResolutionGesture,
  type ResolutionMods,
  synthesizeInput,
} from '../resolutionInput';
import s from '../ToolkitBuilder.module.css';
import { SPECIFICITY_HEADER, withUniqueIds } from './gridCells';

// Resolution: pick an input, see every binding that matches it in dispatch precedence order, with
// the winner marked and each loser's reason. `Dispatcher.resolveAll` is that walk without the
// invoking.
//
//  - Order and modifiers are exact: they are properties of the bindings themselves.
//  - Target is caveated. It stands in for a real hit-test, so a `kindOf` predicate can outrun
//    the synthesized hit; predicate rows carry a `?`.
//  - `disabled` reasons are caveated. `enabled()` runs against a stub DepRegistry that resolves
//    every dep to undefined, so `requiresSelection` reports "selection-required" whatever is
//    really selected. Those rows carry a `?` too.
//  - `ineligible` never appears: no `getRuleCtx` is supplied, so the eligibility gate is skipped.

const MOD_KEYS = ['shift', 'alt', 'meta', 'ctrl'] as const;
type ModKey = (typeof MOD_KEYS)[number];

/** `resolveAll` reads only what this ctx hands it, so a throwaway dispatcher
 *  and these two inert stubs are enough — the query never invokes anything
 *  and never resolves a dep. */
const STUB_DEP_REGISTRY: DepRegistry = {
  register: () => () => {},
  get: () => undefined,
};

function stubActionsRegistry(actions: readonly Action[]): ActionsRegistry {
  return {
    register: () => () => {},
    unregister: () => {},
    mute: () => () => {},
    tune: () => () => {},
    overrideBindings: () => () => {},
    bindingOverrides: () => new Map(),
    paramsOf: (_id, given) => ({ ...given }),
    list: () => actions,
    trigger: () => false,
    preview: () => () => {},
    subscribe: () => () => {},
    begin: () => null,
    setDispatcher: () => () => {},
    activate: () => {},
    isActive: () => true,
    holdsKeys: () => true,
    dropKeys: () => {},
  };
}

export function ResolutionWidget({
  tools,
  actions,
  activeToolId,
}: {
  /** Live `Tool`s off the `ToolsApi`, each carrying the declared eligibility
   *  that decides which scope tier its bindings assemble at. */
  tools: readonly Tool[];
  actions: readonly Action[];
  activeToolId: string;
}): ReactElement {
  const [gesture, setGesture] = useState<ResolutionGesture>('drag');
  const [target, setTarget] = useState<string>('selected-body');
  const [mods, setMods] = useState<ResolutionMods>({});

  // Options come from the targets the mounted tools actually bind against, so the picker can't
  // offer a target nothing listens for. Both lists are empty for a tool set that describes its
  // targets with predicates only.
  const { affordanceKinds, nodeKinds } = useMemo(() => {
    const affordances = new Set<string>();
    const nodes = new Set<string>();
    for (const entry of buildRouteRegistry(tools)) {
      if (entry.target?.startsWith(AFFORDANCE_PREFIX)) {
        affordances.add(entry.target.slice(AFFORDANCE_PREFIX.length));
      } else if (entry.target?.startsWith(KIND_PREFIX)) {
        nodes.add(entry.target.slice(KIND_PREFIX.length));
      }
    }
    return {
      affordanceKinds: [...affordances].sort(),
      nodeKinds: [...nodes].sort(),
    };
  }, [tools]);

  const targetOptions = [
    ...RESOLUTION_BODY_TARGETS.map((t) => ({ value: t, label: t })),
    ...affordanceKinds.map((k) => ({ value: `${AFFORDANCE_PREFIX}${k}`, label: `chrome: ${k}` })),
    ...nodeKinds.map((k) => ({ value: `${KIND_PREFIX}${k}`, label: `node: ${k}` })),
  ];

  // `wheel` and `key` events carry no target for the matcher to read, so the
  // picker would be a control with no effect.
  const targetApplies = gesture !== 'wheel' && gesture !== 'key';

  const candidates = useMemo(() => {
    const dispatcher = createDispatcher();
    return dispatcher.resolveAll(
      synthesizeInput({ gesture, target, mods }),
      {
        actions: stubActionsRegistry(actions),
        depRegistry: STUB_DEP_REGISTRY,
        activeToolId,
        hotkeyStack: [],
        entriesById: new Map(tools.map((t) => [t.id, t])),
        isMac: false,
      },
      // On the default walk everything below the winner reads `shadowed`. Evaluating past the
      // winner distinguishes "outranked" from "outranked AND disabled".
      { evaluateShadowed: true },
    );
  }, [gesture, target, mods, actions, activeToolId, tools]);

  return (
    <PropertyPanel stance="debug" className={s.widget} title={`Resolution · ${candidates.length}`}>
      <div className={s.resolutionControls}>
        <Select<ResolutionGesture>
          label="gesture"
          orientation="row"
          width="fit"
          options={RESOLUTION_GESTURES.map((g) => ({ value: g, label: g }))}
          selectedKey={gesture}
          onSelectionChange={setGesture}
        />
        <span
          title={targetApplies
            ? undefined
            : `target matching doesn't apply to a ${gesture} event — it carries no target for the matcher to read`}
        >
          <Select
            label="target"
            orientation="row"
            width="fit"
            isDisabled={!targetApplies}
            options={targetOptions}
            selectedKey={target}
            onSelectionChange={setTarget}
          />
        </span>
        <ToggleBar<ModKey>
          mode="multiple"
          size="sm"
          ariaLabel="modifiers"
          items={MOD_KEYS.map((m) => ({ value: m, label: m }))}
          value={MOD_KEYS.filter((m) => mods[m])}
          onChange={(next) => setMods(Object.fromEntries(next.map((m) => [m, true])))}
        />
      </div>
      <div className={s.widgetBodyScrollXY}>
        {candidates.length === 0 ? (
          <p className={s.empty}>No binding matches this input.</p>
        ) : (
          <DataGrid
            rows={withUniqueIds(candidates.map((c, i) => ({
              key: `${c.scope}|${c.ownerId ?? ''}|${c.actionId}`,
              rank: i + 1,
              candidate: c,
            })))}
            columns={RESOLUTION_COLUMNS}
            rowClassName={(r) => verdictClass(r.candidate.verdict.kind)}
          />
        )}
      </div>
    </PropertyPanel>
  );
}

interface ResolutionRow { id: string; rank: number; candidate: ResolvedCandidate }

const RESOLUTION_COLUMNS: readonly DataGridColumn<ResolutionRow>[] = [
  { id: 'rank', header: '#', sortable: false },
  { id: 'scope', header: 'Scope', sortable: false, render: (r) => r.candidate.scope },
  {
    id: 'tool',
    header: 'Tool',
    sortable: false,
    render: ({ candidate: c }) => (
      <>
        <code>{c.ownerId ?? '—'}</code>
        {isPredicateTarget(c.binding.spec) && (
          <Caveat text="Evaluated against a synthesized hit — a predicate reading more than `kind` may differ at runtime." />
        )}
      </>
    ),
  },
  { id: 'action', header: 'Action', sortable: false, render: (r) => <code>{r.candidate.actionId}</code> },
  {
    id: 'specificity',
    header: SPECIFICITY_HEADER,
    sortable: false,
    render: (r) => <code>{r.candidate.specificity.join(' · ')}</code>,
  },
  {
    id: 'verdict',
    header: 'Verdict',
    sortable: false,
    render: ({ candidate: c }) => (
      <>
        {verdictText(c.verdict)}
        {c.verdict.kind === 'disabled' && (
          <Caveat text="`enabled()` ran against a synthesized context with no deps wired, so this reason reflects an empty selection / scene rather than the live one." />
        )}
      </>
    ),
  },
];

/** A `?` marking a result this panel can only approximate. */
function Caveat({ text }: { text: string }): ReactElement {
  return (
    <Badge className={s.predicateBadge} grade="warn" size="xs" aria-label="Approximate" tooltip={text}>
      ?
    </Badge>
  );
}

function verdictClass(kind: ResolvedCandidate['verdict']['kind']): string {
  if (kind === 'would-fire') return s.verdictFires;
  if (kind === 'shadowed') return s.verdictShadowed;
  return s.verdictBlocked;
}

function verdictText(verdict: ResolvedCandidate['verdict']): string {
  if (verdict.kind === 'would-fire') return 'fires';
  if (verdict.kind === 'shadowed') return 'shadowed';
  return `${verdict.kind}: ${verdict.reason}`;
}
