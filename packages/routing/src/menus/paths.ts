/** A map key as one segment of a dotted path: a `.` or `\` in it is escaped with a `\`. */
export function pathSegment(key: string): string {
  return key.replace(/[\\.]/g, '\\$&');
}

/** A dotted path's segments, each unescaped: the inverse of joining {@link pathSegment}s with `.`. */
export function pathSegments(path: string): string[] {
  const out: string[] = [];
  let seg = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i]!;
    if (ch === '\\' && i + 1 < path.length) seg += path[++i];
    else if (ch === '.') { out.push(seg); seg = ''; } else seg += ch;
  }
  out.push(seg);
  return out;
}

/** The path holding the value at `path`, or `undefined` at the top: everything before its last unescaped `.`. */
export function parentPath(path: string): string | undefined {
  let dot = -1;
  for (let i = 0; i < path.length; i++) {
    if (path[i] === '\\') i++;
    else if (path[i] === '.') dot = i;
  }
  return dot < 0 ? undefined : path.slice(0, dot);
}
