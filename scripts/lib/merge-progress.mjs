const PLAN = /^onto: plan \d+\/(\d+) (\S+)$/;
const PROGRESS = /^onto: progress (\d+)\/(\d+) (\S+)$/;
const FAILED = /^onto: failed (\d+)\/(\d+) (\S+)$/;
const TALLY = /^onto: tests (\d+) passed (\d+) failed (\d+) skipped$/;

/**
 * Folds the onto progress lines of several vitest processes into the lines one process would have
 * printed. Each child's reporter states running totals, not increments, so passing their lines on
 * unchanged would have onto's bar jump between them; and onto keeps only the last `onto: tests`
 * line it sees, so a child's own tally would stand for the whole run.
 *
 * `line(child, text)` returns the lines to print; `finish()` returns the tally, once every child
 * that ran a test has given one.
 */
export const mergeProgress = (children, expected = 0) => {
  const state = Array.from({ length: children }, () => ({ total: 0, done: 0, failed: 0, tally: null }));
  let label = 'tests';
  let total = 0;
  let done = -1;
  let bad = 0;
  let planned = false;
  let tallied = false;

  const sum = (key) => state.reduce((n, s) => n + s[key], 0);

  const progress = () => {
    const out = [];
    total = Math.max(total, expected, sum('total'));
    if (total <= 0) return out;
    if (!planned) {
      out.push(`onto: plan 0/${total} ${label}`);
      planned = true;
    }
    const nowDone = Math.min(sum('done'), total);
    const nowBad = Math.min(sum('failed'), nowDone);
    const moved = nowDone !== done;
    if (moved) out.push(`onto: progress ${nowDone}/${total} ${label}`);
    if (nowBad > 0 && (moved || nowBad !== bad)) out.push(`onto: failed ${nowBad}/${total} ${label}`);
    done = nowDone;
    bad = nowBad;
    return out;
  };

  const finish = () => {
    if (tallied) return [];
    const ran = state.filter((s) => s.tally);
    if (ran.length === 0) return [];
    tallied = true;
    const t = ran.reduce((a, s) => ({ passed: a.passed + s.tally.passed, failed: a.failed + s.tally.failed, skipped: a.skipped + s.tally.skipped }), { passed: 0, failed: 0, skipped: 0 });
    const exact = t.passed + t.failed + t.skipped;
    const out = [`onto: plan 0/${exact} ${label}`, `onto: progress ${exact}/${exact} ${label}`];
    if (t.failed > 0) out.push(`onto: failed ${t.failed}/${exact} ${label}`);
    out.push(`onto: tests ${t.passed} passed ${t.failed} failed ${t.skipped} skipped`);
    return out;
  };

  const line = (child, text) => {
    const s = state[child];
    let m;
    if ((m = TALLY.exec(text))) {
      s.tally = { passed: +m[1], failed: +m[2], skipped: +m[3] };
      s.done = s.tally.passed + s.tally.failed + s.tally.skipped;
      s.total = s.done;
      s.failed = s.tally.failed;
      return progress();
    }
    if ((m = PLAN.exec(text))) {
      label = m[2];
      if (!s.tally) s.total = Math.max(s.total, +m[1]);
      return progress();
    }
    if ((m = PROGRESS.exec(text))) {
      label = m[3];
      s.done = +m[1];
      s.total = Math.max(s.total, +m[2]);
      return progress();
    }
    if ((m = FAILED.exec(text))) {
      s.failed = +m[1];
      return progress();
    }
    return [text];
  };

  return { line, finish };
};
