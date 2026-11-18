/**
 * Whether a value that crossed a `postMessage` or an extension port is a protocol message. Anything in the page,
 * or in another frame, can post one, so each side checks what it hears before reading a field.
 */
import { DEVTOOLS_PROTOCOL, type DevtoolsRootInfo, type PageMessage, type PanelMessage } from './protocol';

type Fields = Record<string, unknown>;

const isFields = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): boolean => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isRequestId = (v: unknown): v is number => Number.isSafeInteger(v);
const optional = (v: unknown, is: (v: unknown) => boolean): boolean => v === undefined || is(v);
const isNumber = (v: unknown): boolean => typeof v === 'number';

function isRootInfo(v: unknown): v is DevtoolsRootInfo {
  return isFields(v) && typeof v.id === 'string' && typeof v.label === 'string' && (v.dimension === '2d' || v.dimension === '3d');
}

/**
 * Whether `m` is a message a panel sends, every field it reads the type the protocol gives it. A message naming
 * another protocol passes on any `type`, for the page to answer with the mismatch.
 */
export function isPanelMessage(m: unknown): m is PanelMessage {
  if (!isFields(m) || typeof m.protocol !== 'number') return false;
  if (m.protocol !== DEVTOOLS_PROTOCOL) return optional(m.requestId, isRequestId);
  if (m.type === 'yo' || m.type === 'bye') return true;
  if (!isRequestId(m.requestId) || typeof m.rootId !== 'string') return false;
  switch (m.type) {
    case 'get-children': return optional(m.nodeId, (v) => typeof v === 'string');
    case 'get-node': return typeof m.nodeId === 'string';
    case 'get-state':
    case 'get-frame':
    case 'get-registry': return true;
    case 'get-trace': return isNumber(m.cursor) && optional(m.coordCursor, isNumber);
    case 'get-history': return isNumber(m.cursor) && optional(m.historyEntries, (v) => typeof v === 'boolean');
    case 'select':
    case 'highlight': return isStrings(m.ids);
    case 'set-tool': return m.toolId === null || typeof m.toolId === 'string';
    case 'set-overlays': return isFields(m.overlays) && Object.values(m.overlays).every((v) => typeof v === 'boolean');
    default: return false;
  }
}

/** Whether `m` is a message a page sends, every field it reads the type the protocol gives it. A `result`'s payload
 *  is the request's to read. */
export function isPageMessage(m: unknown): m is PageMessage {
  if (!isFields(m) || typeof m.protocol !== 'number') return false;
  switch (m.type) {
    case 'sup': return typeof m.kitVersion === 'string' && Array.isArray(m.roots) && m.roots.every(isRootInfo);
    case 'root-added': return isRootInfo(m.root);
    case 'root-removed': return typeof m.rootId === 'string';
    case 'changed': return typeof m.rootId === 'string' && isFields(m.areas) && Object.values(m.areas).every(isNumber);
    case 'result': return isRequestId(m.requestId) && 'result' in m;
    case 'error': return (m.requestId === null || isRequestId(m.requestId)) && typeof m.message === 'string';
    default: return false;
  }
}
