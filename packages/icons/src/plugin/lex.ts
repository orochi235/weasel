/** A half-open `[start, end)` span of source that is not code: a comment, a string, a template's text, a regex. */
export type Span = readonly [number, number];

// After one of these (or at the start), a `/` begins a regex literal rather than dividing.
const BEFORE_REGEX = new Set([...'(,=:[!&|?{};+-*%<>~^']);

/** Every comment, string, template text and regex literal in `code`, in source order. */
export function opaqueSpans(code: string): Span[] {
  const spans: Span[] = [];
  const templates: number[] = [];
  const n = code.length;
  let depth = 0;
  let prev = '';

  const push = (start: number, end: number) => {
    spans.push([start, Math.min(end, n)]);
    return Math.min(end, n);
  };
  const templateText = (start: number): number => {
    for (let j = start + 1; j < n; j++) {
      if (code[j] === '\\') j++;
      else if (code[j] === '`') return push(start, j + 1);
      else if (code[j] === '$' && code[j + 1] === '{') {
        templates.push(depth);
        return push(start, j + 2);
      }
    }
    return push(start, n);
  };
  const quoted = (start: number, close: string): number => {
    let j = start + 1;
    for (; j < n && code[j] !== close && code[j] !== '\n'; j++) if (code[j] === '\\') j++;
    return push(start, j + 1);
  };
  const regex = (start: number): number => {
    let j = start + 1;
    for (let inClass = false; j < n && code[j] !== '\n'; j++) {
      const c = code[j];
      if (c === '\\') j++;
      else if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
    }
    return push(start, j + 1);
  };

  for (let i = 0; i < n; ) {
    const c = code[i]!;
    const next = code[i + 1];
    if (c === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      i = push(i, end < 0 ? n : end);
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      i = push(i, end < 0 ? n : end + 2);
    } else if (c === '"' || c === "'") {
      i = quoted(i, c);
      prev = c;
    } else if (c === '`') {
      i = templateText(i);
      prev = c;
    } else if (c === '/' && (prev === '' || BEFORE_REGEX.has(prev))) {
      i = regex(i);
      prev = c;
    } else if (c === '}' && templates.length > 0 && templates[templates.length - 1] === depth) {
      templates.pop();
      i = templateText(i);
      prev = '`';
    } else {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  return spans;
}

/** Whether `pos` falls strictly inside one of `spans`; a span's own first character is outside. */
export function inside(spans: readonly Span[], pos: number): boolean {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end] = spans[mid]!;
    if (pos <= start) hi = mid - 1;
    else if (pos >= end) lo = mid + 1;
    else return true;
  }
  return false;
}
