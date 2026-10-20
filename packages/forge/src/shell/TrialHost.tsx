import { useLatest } from '@weasel-js/core';
import { LabBoundary, TrialIdContext } from '@weasel-js/labkit';
import { OverlayPortalProvider } from '@weasel-js/ui/portal-host';
import {
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { auditElement } from '../frame/a11y';
import { createA11yHighlighter } from '../frame/a11yHighlight';
import { createOverrides, type Overrides, scanCssVars } from '../frame/cssVars';
import type { FrameSetup } from '../frame/FrameController';
import { IN_VIEW_MARGIN, useNearViewport } from '../frame/useNearViewport';
import { createGlobalsTarget } from '../frame/globalsTarget';
import type { CssVarReport, Globals, Layout, ToFrame } from '../protocol/messages';
import { useCssOverrides } from './cssVars/overrides';
import { effectiveGlobals, GLOBALS_KEY } from './globals';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { TrialFramesContext } from './trialFrames';

/** Props for `TrialHost`. */
export interface TrialHostProps {
  layout: Layout;
  setup: FrameSetup;
  /** The trial's config, read for its `$globals` pins. */
  config: unknown;
  /** Rendered once the host element exists, with the globals in force on it. */
  children: (globals: Globals) => ReactNode;
  /** Receives the host element, for a caller with no trial to reach it through. */
  hostRef?: RefObject<HTMLElement | null>;
  /** Called once the children's first commit has painted. */
  onRendered?: () => void;
}

const VARS_SETTLE_MS = 100;

/** A selector matching only the element carrying `id`. */
const scopeOf = (id: string) => `[data-fg-host="${id}"]`;

/**
 * One story's box in the workshop document: what a frame document was, as an element. It applies the globals to
 * itself, keeps its CSS variable overrides on itself, contains fixed-position descendants and portals, reports its
 * vars and audits to the trial's frame registry, and unmounts its content while out of view.
 */
export function TrialHost({ layout, setup, config, children, hostRef, onRendered }: TrialHostProps) {
  const trialId = useContext(TrialIdContext);
  const frames = useContext(TrialFramesContext);
  const labGlobals = useContext(StoryGlobalsContext);
  const pins = (config as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY];
  const globals = useMemo(() => effectiveGlobals(labGlobals, pins), [labGlobals, pins]);
  const [persisted] = useCssOverrides();
  const reactId = useId();
  const hostId = trialId ?? reactId;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const inView = useNearViewport(elementRef, IN_VIEW_MARGIN);
  const [pending, setPending] = useState(true);
  const overridesRef = useRef<Overrides | null>(null);
  const latest = useLatest({ setup, onRendered });

  // Everything the host owns for its lifetime: the globals target, the overrides rule, the registry connection.
  useLayoutEffect(() => {
    if (!host) return;
    const doc = host.ownerDocument;
    const scope = scopeOf(hostId);
    const { cssVarsScope } = latest.current.setup;
    const overrides = createOverrides(doc, cssVarsScope ? `${scope}, ${scope} :is(${cssVarsScope})` : scope);
    overridesRef.current = overrides;
    let lastVars: CssVarReport[] | null = null;
    let reported: string | null = null;
    const publish = (vars: CssVarReport[]) => {
      lastVars = vars;
      const key = JSON.stringify(vars);
      if (key === reported) return;
      reported = key;
      if (trialId) frames?.report(trialId, vars);
    };
    const scan = () => publish(scanCssVars(doc, overrides.has, host));
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const ownMutation = (record: MutationRecord) =>
      overrides.owns(record.target) ||
      (record.type === 'childList' &&
        [...record.addedNodes, ...record.removedNodes].length > 0 &&
        [...record.addedNodes, ...record.removedNodes].every(overrides.owns));
    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver((records) => {
            if (records.every(ownMutation)) return;
            clearTimeout(settleTimer);
            settleTimer = setTimeout(scan, VARS_SETTLE_MS);
          });
    mutations?.observe(host, { subtree: true, childList: true, characterData: true, attributes: true });

    const highlighter = createA11yHighlighter(doc);
    const send = (msg: ToFrame) => {
      if (msg.type === 'a11y.highlight') highlighter.show(msg.targets);
      if (msg.type !== 'vars.set') return;
      overrides.set(msg.name, msg.value);
      if (lastVars?.some((v) => v.name === msg.name)) scan();
    };
    const audit = async () => {
      const outcome = await auditElement(host, { page: false });
      if (trialId) frames?.reportA11y(trialId, outcome);
      return outcome;
    };
    const disconnect = frames && trialId ? frames.connect(trialId, { send, audit }) : () => {};

    return () => {
      disconnect();
      highlighter.dispose();
      mutations?.disconnect();
      clearTimeout(settleTimer);
      overrides.dispose();
      overridesRef.current = null;
    };
  }, [host, hostId, trialId, frames, latest]);

  // The overrides the trial persisted, put back on every mount and kept in step with the panel's edits.
  const applied = useRef<Record<string, string>>({});
  useLayoutEffect(() => {
    const overrides = overridesRef.current;
    if (!overrides) return;
    for (const name of Object.keys(applied.current)) if (!(name in persisted)) overrides.set(name, null);
    for (const [name, value] of Object.entries(persisted)) overrides.set(name, value);
    applied.current = { ...persisted };
  }, [host, persisted]);

  useLayoutEffect(() => {
    if (!host) return;
    const target = createGlobalsTarget(host, scopeOf(hostId));
    latest.current.setup.applyGlobals?.(globals, target);
    return () => target.dispose();
  }, [host, hostId, globals, latest]);

  // The host is hidden until its first commit has painted with its fonts, so a new trial never shows a jump.
  const announced = useRef(false);
  useEffect(() => {
    if (!host || !inView || announced.current) return;
    let canceled = false;
    const done = () => {
      if (canceled) return;
      announced.current = true;
      setPending(false);
      latest.current.onRendered?.();
    };
    const { fonts } = host.ownerDocument;
    if (!fonts) {
      done();
      return;
    }
    const afterPaint = () => requestAnimationFrame(done);
    void fonts.ready.then(afterPaint, afterPaint);
    return () => {
      canceled = true;
    };
  }, [host, inView, latest]);

  return (
    <div
      ref={(el) => {
        elementRef.current = el;
        if (hostRef) hostRef.current = el;
        setHost(el);
      }}
      className="fg-story"
      data-fg-host={hostId}
      data-fg-layout={layout}
      data-pending={pending || undefined}
    >
      {host && inView ? (
        // The workshop is itself a lab; below the boundary a story sees no lab, trial or theme above it, as in a
        // document of its own.
        <LabBoundary>
          <OverlayPortalProvider container={host}>{children(globals)}</OverlayPortalProvider>
        </LabBoundary>
      ) : null}
    </div>
  );
}
