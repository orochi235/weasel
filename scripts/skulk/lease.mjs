/**
 * Leases on disk, shared by every process that runs a round: a file created with `wx` holds a thing for
 * one process, and a lease whose process has died is taken back. Node tree slots, the merge lock and the
 * plan lock are all leases.
 */
import { linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync, closeSync } from 'node:fs';
import { dirname } from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Whether process `pid` is alive. EPERM means it is, owned by someone else. */
export const pidAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

/** What a lease file says, or `undefined` when it is gone or unreadable. */
export const leaseAt = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

const create = (path, holder) => {
  const fd = openSync(path, 'wx');
  try {
    writeSync(fd, JSON.stringify(holder));
  } finally {
    closeSync(fd);
  }
};

/**
 * Takes the lease back when its holder is dead. Renaming moves exactly one file away even when two
 * processes race; if what moved turns out to be a live holder's new lease, it is linked back.
 */
const reclaim = (path) => {
  const held = leaseAt(path);
  // A half-written file reads as undefined; only a lease naming a dead pid is taken back.
  if (!held || pidAlive(held.pid)) return false;
  const aside = `${path}.stale-${process.pid}-${Date.now()}`;
  try {
    renameSync(path, aside);
  } catch {
    return false;
  }
  const moved = leaseAt(aside);
  if (moved && pidAlive(moved.pid)) {
    try {
      linkSync(aside, path);
    } catch { /* someone holds it again either way */ }
    rmSync(aside, { force: true });
    return false;
  }
  rmSync(aside, { force: true });
  return true;
};

/**
 * Takes the lease at `path` for this process, recording `{ pid, at, ...about }`. Answers a `release`
 * function, or `undefined` when a live process holds it.
 */
export const takeLease = (path, about = {}) => {
  mkdirSync(dirname(path), { recursive: true });
  const holder = { pid: process.pid, at: new Date().toISOString(), ...about };
  for (let tries = 0; tries < 2; tries++) {
    try {
      create(path, holder);
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        if (leaseAt(path)?.pid === process.pid) rmSync(path, { force: true });
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!reclaim(path)) return undefined;
    }
  }
  return undefined;
};

/** Waits for the lease at `path`, polling every `pollMs`, and answers its `release`. `onWait(holder)` hears once that it waits. */
export const waitForLease = async (path, about = {}, { pollMs = 15_000, onWait } = {}) => {
  for (let waited = false; ; waited = true) {
    const release = takeLease(path, about);
    if (release) return release;
    if (!waited) onWait?.(leaseAt(path));
    await sleep(pollMs);
  }
};
