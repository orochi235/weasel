/** What travels between the extension's parts, beyond core's own protocol messages. */
import {
  DEVTOOLS_ENVELOPE, isDevtoolsEnvelope, type DevtoolsEnvelope, type PageMessage, type PanelMessage,
} from '@weasel-js/core/devtools-protocol';

/** Whether a posted message's `data` is devtools traffic sent by `side`. */
export function envelopeFrom(data: unknown, side: DevtoolsEnvelope['side']): data is DevtoolsEnvelope {
  return isDevtoolsEnvelope(data) && data.side === side && typeof data.message === 'object' && data.message !== null;
}

export function wrap(side: DevtoolsEnvelope['side'], message: PageMessage | PanelMessage): DevtoolsEnvelope {
  return { source: DEVTOOLS_ENVELOPE, side, message };
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

/** What a content script sends the background as it loads: is a panel open on my tab? */
export const HELLO = { weaselDevtools: 'hello' } as const;

export function isHello(m: unknown): boolean {
  return typeof m === 'object' && m !== null && (m as typeof HELLO).weaselDevtools === 'hello';
}

export const PORT_PAGE = 'weasel-devtools-page';
export const PORT_PANEL = 'weasel-devtools-panel';
