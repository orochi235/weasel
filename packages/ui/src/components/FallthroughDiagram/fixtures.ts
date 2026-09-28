import type { DispatchRecord, RecordCandidate } from '@weasel-js/core/routing';

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

function candidate(c: Partial<RecordCandidate> & Pick<RecordCandidate, 'actionId' | 'routes'>): RecordCandidate {
  return { scope: 'ambient', ownerToolId: null, namesView: false, specificity: [0, 0, 0, 1], ...c };
}

const escape = candidate({ actionId: 'escape', routes: ['[*:initial] keyDown(Escape)'], specificity: [0, 0, 1, 1] });
const exitPathEdit = candidate({ actionId: 'exitPathEdit', routes: ['[*:*] keyDown(Escape)'], eligible: 'mode: path-edit' });
const resetToDefault = candidate({ actionId: 'tool.resetToDefault', routes: ['[*:*] keyDown(Escape)'] });

/** Escape while a path is being edited: the more specific `escape` declines,
 *  and `exitPathEdit` fires. */
export const escapeInPathEdit: DispatchRecord = {
  kind: 'dispatch',
  ts: 53527310,
  input: { eventKind: 'key', key: 'Escape', modifiers: NO_MODS, viewId: 'main', mode: 'path-edit' },
  matched: [escape, exitPathEdit, resetToDefault],
  dropped: [],
  ranked: [
    { candidate: escape, placedBy: { step: 'first' }, walk: { kind: 'declined', reason: 'not-applicable' } },
    { candidate: exitPathEdit, placedBy: { step: 'specificity', part: 'phase' }, walk: { kind: 'fired' } },
    { candidate: resetToDefault, placedBy: { step: 'context' }, walk: { kind: 'not-asked' } },
  ],
  predicted: false,
  fired: 'exitPathEdit',
  outcome: 'handled',
};

const selectAreaSelect = candidate({
  actionId: 'areaSelect',
  routes: ['[*:*] drag => predicate'],
  scope: 'active',
  ownerToolId: 'select',
  specificity: [1, 0, 0, 1],
  eligible: 'capability: creates-selection',
});
const ambientAreaSelect = candidate({
  actionId: 'areaSelect',
  routes: ['[*:*] drag => predicate'],
  ownerToolId: 'selection.areaSelect',
  specificity: [1, 0, 0, 1],
  eligible: 'capability: creates-selection',
});
const dragPan = candidate({ actionId: 'viewport.dragPan', routes: ['[*:*] drag'] });

/** A bare drag on empty canvas with the select tool, on a canvas that also
 *  opted into `areaSelectContribution`: the tool's marquee wins, and the
 *  contribution's binding of the same action is skipped as a duplicate. */
export const bareDragSelect: DispatchRecord = {
  kind: 'dispatch',
  ts: 53525020,
  input: { eventKind: 'pointerdown', modifiers: NO_MODS, viewId: null, world: { x: 120, y: 80 }, mode: 'normal' },
  matched: [selectAreaSelect, ambientAreaSelect, dragPan],
  dropped: [],
  ranked: [
    { candidate: selectAreaSelect, placedBy: { step: 'first' }, walk: { kind: 'fired' } },
    { candidate: ambientAreaSelect, placedBy: { step: 'tier' }, walk: { kind: 'duplicate' } },
    { candidate: dragPan, placedBy: { step: 'specificity', part: 'target' }, walk: { kind: 'not-asked' } },
  ],
  predicted: false,
  fired: 'areaSelect',
  outcome: 'handled',
};

const moveBody = candidate({
  actionId: 'move',
  routes: ['[*:*] drag => unselected-body'],
  scope: 'active',
  ownerToolId: 'select',
  specificity: [1, 0, 0, 1],
});
const portsConnect = candidate({
  actionId: 'ports.connect',
  routes: ['[*:*] drag => affordance:layer:diagram-ports'],
  specificity: [1, 0, 0, 1],
});

/** A press on a diagram port: the port layer's exclusive claim bars every
 *  binding that does not read its affordance. */
export const claimDropped: DispatchRecord = {
  kind: 'dispatch',
  ts: 53524880,
  input: { eventKind: 'pointerdown', modifiers: NO_MODS, viewId: 'main', world: { x: 312, y: 144 }, mode: 'normal' },
  matched: [moveBody, dragPan, portsConnect],
  dropped: [
    { candidate: moveBody, filter: 'claim', owner: 'layer:diagram-ports' },
    { candidate: dragPan, filter: 'claim', owner: 'layer:diagram-ports' },
  ],
  ranked: [{ candidate: portsConnect, placedBy: { step: 'first' }, walk: { kind: 'fired' } }],
  predicted: false,
  fired: 'ports.connect',
  outcome: 'handled',
};

const moveAnchors = candidate({
  actionId: 'moveAnchors',
  routes: ['[*:*] drag => anchor', '[*:*] drag => anchor +shift'],
  scope: 'active',
  ownerToolId: 'path-edit',
  specificity: [1, 0, 0, 1],
});
const transformSelection = candidate({
  actionId: 'transformSelection',
  routes: ['[*:*] drag => selection'],
  specificity: [1, 0, 0, 1],
  eligible: 'capability: has-selection',
});

/** What a press at the pointer would do, asked without invoking anything. */
export const predictedHover: DispatchRecord = {
  kind: 'dispatch',
  ts: 53528000,
  input: { eventKind: 'pointerdown', modifiers: NO_MODS, viewId: 'main', world: { x: 48, y: 210 }, mode: 'path-edit' },
  matched: [moveAnchors, transformSelection, dragPan],
  dropped: [{ candidate: transformSelection, filter: 'ineligible', rule: 'capability: has-selection' }],
  ranked: [
    { candidate: moveAnchors, placedBy: { step: 'first' }, walk: { kind: 'would-fire' } },
    { candidate: dragPan, placedBy: { step: 'tier' }, walk: { kind: 'not-asked' } },
  ],
  predicted: true,
  fired: 'moveAnchors',
  outcome: 'handled',
};

/** Shift+Space with nothing bound to it. */
export const nothingMatched: DispatchRecord = {
  kind: 'dispatch',
  ts: 53529100,
  input: { eventKind: 'key', key: ' ', modifiers: { ...NO_MODS, shift: true }, viewId: null },
  matched: [],
  dropped: [],
  ranked: [],
  predicted: false,
  fired: null,
  outcome: 'unhandled',
};
