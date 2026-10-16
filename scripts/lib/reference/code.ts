import type { Code, CodeToken } from '../../../apps/shared/reference.ts';

/** Where a reader finds the page for something TypeDoc names. */
export interface Links {
  /** The page of the reflection with this id, or of the export that holds it. */
  byId(id: number): string | undefined;
  /** The page of an export known only by its package and name. */
  byName(packageName: string | undefined, name: string): string | undefined;
  /** The summary of the export with this id, following re-exports to the declaration. */
  summary(id: number): string;
}

/** Builds a run of code, keeping neighboring text in one token. */
export class CodeWriter {
  private readonly tokens: CodeToken[] = [];

  text(text: string): this {
    if (text === '') return this;
    const last = this.tokens.length - 1;
    const tail = this.tokens[last];
    if (typeof tail === 'string') this.tokens[last] = tail + text;
    else this.tokens.push(text);
    return this;
  }

  /** A name, linked when `to` says where it leads. */
  name(text: string, to: string | undefined): this {
    if (to === undefined) return this.text(text);
    this.tokens.push({ text, to });
    return this;
  }

  code(code: Code): this {
    for (const token of code) {
      if (typeof token === 'string') this.text(token);
      else this.tokens.push(token);
    }
    return this;
  }

  /** Each item written by `write`, with `separator` between them. */
  each<T>(items: readonly T[], separator: string, write: (item: T) => void): this {
    items.forEach((item, i) => {
      if (i > 0) this.text(separator);
      write(item);
    });
    return this;
  }

  done(): Code {
    return this.tokens;
  }
}

/** A run of code as the text a reader would copy. */
export function plain(code: Code): string {
  return code.map((token) => (typeof token === 'string' ? token : token.text)).join('');
}
