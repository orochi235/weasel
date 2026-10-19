/**
 * The slice of the WebExtensions API this extension calls, typed by hand, and
 * one accessor that reads it from `browser` (Firefox, Safari) or `chrome`
 * (Chrome, Edge). Where the two differ — `eval`, which Chrome answers by
 * callback — the wrapper below takes either shape.
 */

export interface ExtEvent<A extends unknown[]> {
  addListener(listener: (...args: A) => void): void;
  removeListener(listener: (...args: A) => void): void;
}

/** A `runtime.Port`, as far as this extension uses one. */
export interface PortLike {
  readonly name: string;
  readonly sender?: { tab?: { id?: number }; frameId?: number };
  postMessage(message: unknown): void;
  disconnect(): void;
  readonly onMessage: ExtEvent<[message: unknown, port: PortLike]>;
  readonly onDisconnect: ExtEvent<[port: PortLike]>;
}

type EvalCallback = (result: unknown, exception?: unknown) => void;

export interface ExtensionApi {
  runtime: {
    connect(info: { name: string }): PortLike;
    readonly onConnect: ExtEvent<[port: PortLike]>;
    sendMessage(message: unknown): Promise<unknown>;
    readonly onMessage: ExtEvent<[message: unknown, sender: PortLike['sender'], respond: (r?: unknown) => void]>;
  };
  tabs?: {
    sendMessage(tabId: number, message: unknown): Promise<unknown> | void;
  };
  scripting?: {
    executeScript(injection: { target: { tabId: number; allFrames: boolean }; files: string[] }): Promise<unknown>;
  };
  devtools?: {
    inspectedWindow: {
      readonly tabId: number;
      eval(expression: string, callback?: EvalCallback): Promise<[unknown, unknown?]> | void;
    };
    panels: {
      create(title: string, iconPath: string, pagePath: string, callback?: (panel: unknown) => void): unknown;
    };
    network: { readonly onNavigated: ExtEvent<[url: string]> };
  };
}

/** The extension API of whichever browser this runs in. */
export function extensionApi(): ExtensionApi {
  const g = globalThis as { browser?: ExtensionApi; chrome?: ExtensionApi };
  const api = g.browser ?? g.chrome;
  if (!api) throw new Error('weasel devtools: no extension API in this context');
  return api;
}

/**
 * Evaluate `expression` in the inspected page. Chrome now has a `browser` namespace too, but its
 * promise resolves to the bare result where Firefox's resolves to `[result, exception]`, so the
 * callback form, which every browser's `chrome` namespace takes, is used wherever there is one.
 */
export function evalInInspectedWindow(api: ExtensionApi, expression: string): Promise<unknown> {
  const withCallback = (globalThis as { chrome?: ExtensionApi }).chrome?.devtools?.inspectedWindow;
  const inspected = withCallback ?? api.devtools?.inspectedWindow;
  if (!inspected) return Promise.reject(new Error('not a devtools page'));
  return new Promise((resolve, reject) => {
    const done: EvalCallback = (result, exception) => (exception ? reject(exception) : resolve(result));
    if (withCallback) {
      withCallback.eval(expression, done);
      return;
    }
    const promise = inspected.eval(expression);
    if (!promise) return reject(new Error('inspectedWindow.eval returned no promise'));
    promise.then((answer) => (Array.isArray(answer) ? done(answer[0], answer[1]) : done(answer)), reject);
  });
}
