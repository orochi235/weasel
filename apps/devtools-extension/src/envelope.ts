/**
 * The extension's view of core's devtools wire format. Values are restated
 * here rather than imported: importing `@weasel-js/core/devtools` installs a
 * hook, and one in the content script's world would answer the bridge's own
 * `yo`. The type annotations fail the typecheck if core's values change.
 */
import type {
  DEVTOOLS_ENVELOPE, DEVTOOLS_PROTOCOL, DevtoolsEnvelope, PageMessage, PanelMessage,
} from '@weasel-js/core/devtools';

export const ENVELOPE: typeof DEVTOOLS_ENVELOPE = 'weasel-devtools';
export const PROTOCOL: typeof DEVTOOLS_PROTOCOL = 1;

/** Whether a posted message's `data` is devtools traffic sent by `side`. */
export function envelopeFrom(data: unknown, side: DevtoolsEnvelope['side']): data is DevtoolsEnvelope {
  if (typeof data !== 'object' || data === null) return false;
  const e = data as Partial<DevtoolsEnvelope>;
  return e.source === ENVELOPE && e.side === side && typeof e.message === 'object' && e.message !== null;
}

export function wrap(side: DevtoolsEnvelope['side'], message: PageMessage | PanelMessage): DevtoolsEnvelope {
  return { source: ENVELOPE, side, message };
}

/** The first message a panel port sends: which tab it inspects. */
export interface PanelHello {
  inspect: number;
}

export function isPanelHello(m: unknown): m is PanelHello {
  return typeof m === 'object' && m !== null && typeof (m as PanelHello).inspect === 'number';
}

/** What the background sends a tab's content scripts to make them connect. */
export const CONNECT_REQUEST = { weaselDevtools: 'connect' } as const;

export function isConnectRequest(m: unknown): boolean {
  return typeof m === 'object' && m !== null && (m as typeof CONNECT_REQUEST).weaselDevtools === 'connect';
}

export const PORT_PAGE = 'weasel-devtools-page';
export const PORT_PANEL = 'weasel-devtools-panel';
