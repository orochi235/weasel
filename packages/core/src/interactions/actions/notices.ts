/**
 * How an action tells the user something went wrong: the `notices` dep a host
 * publishes, shown however it shows such things (draw raises a toast). Without
 * one the message goes to the console.
 */
import type { TextOutlinesError } from '@weasel-js/text';

/** What a notice says beyond its title. */
export interface NoticeOptions {
  /** One notice per id: a later one with the same id replaces it. */
  id?: string;
  description?: string;
}

/** The host's notice surface, read by actions whose result the user must hear about. */
export interface NoticesDep {
  warn(title: string, opts?: NoticeOptions): void;
}

/** Warn the user through `notices`, or under `tag` on the console without one. */
export function warnUser(notices: NoticesDep | undefined, tag: string, title: string, opts: NoticeOptions = {}): void {
  if (notices) notices.warn(title, opts);
  else console.warn(`[${tag}] ${title}${opts.description ? ` — ${opts.description}` : ''}`);
}

/** Warn that text in `error`'s face could not be turned into outlines. */
export function warnTextOutlines(notices: NoticesDep | undefined, tag: string, error: TextOutlinesError): void {
  warnUser(notices, tag, `Text in "${error.family}" can't be converted to outlines`, {
    id: 'text-outlines', description: error.message,
  });
}
