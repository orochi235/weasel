// Checked by the typecheck, never run: what `ActionParamSchema` types once an extension merges an entry in, read
// through the published entries alone.
import {
  bindAction, defineAction, defineTool, dynamicActionId, resolveParams, useCommand, useOngoingAction,
  type ActionsRegistry, type ActionTunings, type GestureBinding,
} from '@weasel-js/core';
import type { Action } from '@weasel-js/routing';
import { STAMP_ID, stampAction } from './actionParams.extension.fixture';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Stamp = { size: number };

declare const registry: ActionsRegistry;
declare const size: () => number;
declare const runtimeId: string;
const spec = { kind: 'click' } as const;

// An action `defineAction` made is an `Action`, its id kept.
const registered: Action = stampAction;
const id: 'typetest.stamp' = stampAction.id;

// Tunings, as before.
const tuned: ActionTunings = { 'typetest.stamp': { params: () => ({ size: size() }) } };
// @ts-expect-error a size is a number
const tunedWrong: ActionTunings = { 'typetest.stamp': { params: { size: 'wrong' } } };

// Bindings: an id the schema names takes its whole entry, as a record or a thunk.
const bound: GestureBinding[] = [
  { spec, actionId: 'typetest.stamp', opts: { params: { size: 2 } } },
  { spec, actionId: STAMP_ID, opts: { params: () => ({ size: size() }) } },
  // No params at all, as a palette runs it.
  { spec, actionId: 'typetest.stamp', opts: { id: 'stamp.click' } },
  // An id the schema does not name takes none; one held at runtime takes any as a dynamic id.
  { spec, actionId: 'typetest.unnamed' },
  { spec, actionId: dynamicActionId(runtimeId), opts: { params: { anything: true } } },
  bindAction(spec, STAMP_ID, { params: () => ({ size: 3 }) }),
];
// @ts-expect-error a size is a number
const boundWrong: GestureBinding = { spec, actionId: 'typetest.stamp', opts: { params: { size: 'wrong' } } };
// @ts-expect-error the entry's size is required
const boundMissing: GestureBinding = { spec, actionId: 'typetest.stamp', opts: { params: {} } };
// @ts-expect-error a thunk answers the entry too
const boundThunk: GestureBinding = { spec, actionId: 'typetest.stamp', opts: { params: () => ({ size: 'wrong' }) } };
// @ts-expect-error an id the schema does not name takes no params
const boundUnnamed: GestureBinding = { spec, actionId: 'typetest.unnamed', opts: { params: { size: 2 } } };
// @ts-expect-error a runtime id passes params only as a dynamic one
const boundRuntime: GestureBinding = { spec, actionId: runtimeId, opts: { params: { size: 2 } } };
// @ts-expect-error `bindAction` checks as a literal binding does
const boundHelper = bindAction(spec, STAMP_ID, { params: { size: 'wrong' } });

const tool = defineTool({ id: 'typetest.tool', bindings: [{ spec, actionId: STAMP_ID, opts: { params: () => ({ size: size() }) } }] });
const toolWrong = defineTool({
  id: 'typetest.tool',
  // @ts-expect-error a tool's bindings are checked the same way
  bindings: [{ spec, actionId: STAMP_ID, opts: { params: () => ({ size: 'wrong' }) } }],
});

// Programmatic triggers.
const ran = [
  registry.trigger('typetest.stamp', { size: 2 }),
  registry.trigger('typetest.stamp'),
  registry.trigger('typetest.unnamed'),
  registry.trigger(dynamicActionId(runtimeId), { anything: true }),
  registry.trigger(runtimeId),
];
// @ts-expect-error a size is a number
registry.trigger('typetest.stamp', { size: 'wrong' });
// @ts-expect-error the entry's size is required
registry.trigger('typetest.stamp', {});
// @ts-expect-error an id the schema does not name takes no params
registry.trigger('typetest.unnamed', { size: 2 });
// @ts-expect-error a runtime id passes params only as a dynamic one
registry.trigger(runtimeId, { size: 2 });
registry.preview('typetest.stamp', { size: 2 })();
// @ts-expect-error a preview is asked as a trigger is
registry.preview('typetest.stamp', { size: 'wrong' });
registry.begin('typetest.stamp', { size: 1 })?.update({ size: 2 });
// @ts-expect-error a UI-driven edit updates with the entry too
registry.begin('typetest.stamp', { size: 1 })?.update({ size: 'wrong' });
registry.tune('typetest.stamp', { params: () => ({ size: 3 }) });
// @ts-expect-error a tuning's thunk answers the entry
registry.tune('typetest.stamp', { params: () => ({ size: 'wrong' }) });
const resolved: Equal<ReturnType<typeof registry.paramsOf<'typetest.stamp'>>, Partial<Stamp>> = true;

// Invokers read their own params with no cast, each param possibly absent.
const immediate = defineAction({
  id: 'typetest.stamp',
  label: 'Stamp',
  variants: [{ key: 'big', label: 'Big stamp', params: { size: 9 } }],
  defaultBinding: [{ spec, opts: { params: () => ({ size: size() }) } }],
  enabled: (_deps, _at, _carried, params) => (params?.size ?? 1) > 0 || 'too small',
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const read: Equal<typeof params, Partial<Stamp> | undefined> = true;
      // @ts-expect-error a dep is optional: nothing guarantees one was sourced
      deps.selection.get();
      void deps.selection?.get();
      void read; void params;
    },
  },
});
const ongoing = defineAction({
  id: 'typetest.stamp',
  label: 'Stamp',
  invoker: {
    timing: 'ongoing',
    start: (ctx, opts) => {
      const fromBinding: Equal<ReturnType<typeof resolveParams<Partial<Stamp>>>, Partial<Stamp> | undefined> = true;
      const p = resolveParams(opts?.params);
      const read: Equal<typeof p, Partial<Stamp> | undefined> = true;
      const fromBegin: Equal<typeof ctx.params, Partial<Stamp> | undefined> = true;
      void fromBinding; void read; void fromBegin; void p;
      return { replay: (again) => { void again.size; } };
    },
  },
});
const wrongVariant = defineAction({
  id: 'typetest.stamp',
  label: 'Stamp',
  // @ts-expect-error a variant's params are the entry's
  variants: [{ key: 'big', label: 'Big stamp', params: { size: 'wrong' } }],
});
const unnamed = defineAction({
  id: 'typetest.unnamed',
  label: 'Unnamed',
  invoker: { timing: 'immediate', run: (_deps, params) => { const read: unknown = params?.anything; void read; } },
});

export function Stamper(): null {
  useCommand('typetest.stamp', 'Stamp', (params) => {
    const read: Equal<typeof params, Readonly<Partial<Stamp>> | undefined> = true;
    void read; void params;
  });
  const edit = useOngoingAction('typetest.stamp');
  edit.input({ size: 2 });
  // @ts-expect-error a control drives the action with its entry
  edit.input({ size: 'wrong' });
  return null;
}

void registered; void id; void tuned; void tunedWrong; void bound; void boundWrong; void boundMissing; void boundThunk;
void boundUnnamed; void boundRuntime; void boundHelper; void tool; void toolWrong; void ran; void resolved;
void immediate; void ongoing; void wrongVariant; void unnamed;

// An id chosen at runtime states its params; variants and bindings are read against them, not inferred.
const ruled = defineAction<string, { over: boolean }>({
  id: runtimeId,
  label: 'Ruler',
  variants: [{ key: 'over', label: 'Over', params: { over: true } }],
  invoker: { timing: 'immediate', run: (_deps, params) => { const read: boolean | undefined = params?.over; void read; } },
});
const ruledWrong = defineAction<string, { over: boolean }>({
  id: runtimeId,
  label: 'Ruler',
  // @ts-expect-error `over` is a boolean
  variants: [{ key: 'over', label: 'Over', params: { over: 1 } }],
});
const noInfer = defineAction({
  id: 'typetest.stamp',
  label: 'Stamp',
  // @ts-expect-error a variant cannot widen the entry it is checked against
  variants: [{ key: 'other', label: 'Other', params: { other: 1 } }],
});
void ruled; void ruledWrong; void noInfer;
