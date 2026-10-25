// Refuse to start a release that the release job's OIDC credential cannot finish.
//
// npm's OIDC trusted publishing cannot create a package, nor publish one with no
// trust config. Either way the release job's short-lived token gets
// `E404: PUT /<name>` — the same status npm returns for "no such package", which
// is what makes it read like a registry outage rather than a missing bootstrap.
// Creation is tracked upstream as https://github.com/npm/cli/issues/8544.
//
// `npm trust github <name>` can register trust config for a name that is still
// a 404. Whether an OIDC *publish* can then create the package is untested.
//
// `changeset publish` is not atomic. It publishes in dependency order and stops
// at the first failure, so one such package strands the release halfway: some
// of the fixed group at the new version, the rest at the old one, and the
// registry disagreeing with `main`. 1.11.0 stopped 16 of 42 packages in on
// `menu`, which existed on npm but had never been given a trusted publisher.
import { classify, readPending, readStates } from './lib/first-publish.mjs';
import { registryBase } from './lib/registry.mjs';
import { publishableWorkspaces } from './lib/workspaces.mjs';

const warnOnly = process.argv.includes('--warn');

const LABEL = {
  ok: 'ok',
  missing: 'NEVER PUBLISHED',
  untrusted: 'NO TRUSTED PUBLISHER',
  pending: 'trust registered, awaiting first CI publish',
};

const packages = publishableWorkspaces();
const pending = readPending();
const { states, errors } = await readStates(
  packages.map(({ manifest }) => manifest.name),
  {
    warn: warnOnly,
    onEach: (i, name, state) => {
      const label = state ? LABEL[classify([state], pending).status[name]] : 'REGISTRY ERROR';
      console.log(`[first-publish] ${i + 1}/${packages.length} ${name} — ${label}`);
    },
  },
);

const { missing, untrusted, stale } = classify(states, pending);

const register = (names) => [
  'Register the trusted publisher in a real terminal (it prompts for 2FA), naming',
  'the package, or it sweeps all of them with a 2FA challenge each:',
  '',
  ...names.map((n) => `  node scripts/setup-trusted-publishing.mjs ${n}`),
  '',
  'It records the package in scripts/trust-pending.json. Commit that file: it is',
  'how this gate knows trust is registered before the release job has used it.',
];

const lines = [];
if (missing.length > 0) {
  lines.push(
    `[first-publish] ${missing.length} package(s) have never been published:`,
    '',
    ...missing.map((n) => `  ${n}`),
    '',
    'The release job publishes over OIDC, which cannot create a package, so it',
    'would fail on these after publishing their siblings and leave the registry',
    'split across two versions. Publish each one once by hand, from a checkout',
    'with the version the release is about to cut:',
    '',
    ...missing.map((n) => `  npm publish -w ${n} --tag pre --provenance=false`),
    '',
    '(provenance is off because npm only attests from CI; the release job keeps it.)',
    'Run it in a real terminal, never through an agent or a `!` prompt: the',
    "account's 2FA is a passkey, which approves in the browser while npm waits on a",
    'TTY. Without one npm fails EOTP with the approval URL masked, and a passkey',
    'has no code to pass as --otp.',
    'Then, so CI owns every publish after this one:',
    ...register(missing),
    '',
  );
}
if (untrusted.length > 0) {
  lines.push(
    `[first-publish] ${untrusted.length} package(s) are on npm but no version came from a trusted publisher:`,
    '',
    ...untrusted.map((n) => `  ${n}`),
    '',
    'The release job would fail on these with E404 PUT after publishing their',
    'siblings, leaving the registry split across two versions.',
    ...register(untrusted),
    '',
  );
}

if (stale.length > 0) {
  console.warn(
    [
      '[first-publish] these have now been published by the release job; remove them',
      'from scripts/trust-pending.json:',
      ...stale.map((n) => `  ${n}`),
    ].join('\n'),
  );
}

if (errors.length > 0) {
  lines.push(
    `[first-publish] ${errors.length} package(s) could not be checked; the registry answered with an error:`,
    '',
    ...errors.map(({ message }) => `  ${message}`),
    '',
  );
}

if (lines.length > 0) {
  const report = lines.join('\n');
  if (warnOnly) {
    console.warn(report);
  } else {
    console.error(report);
    process.exit(1);
  }
} else {
  console.log(
    `[first-publish] OK — all ${packages.length} publishable package(s) exist on ${registryBase()} with a trusted publisher.`,
  );
}
