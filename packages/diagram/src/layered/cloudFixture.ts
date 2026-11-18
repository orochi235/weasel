/** Test fixture: a cloud architecture the layered layout once drew badly. */
import type { DiagramData } from '../dataTypes';

const fns = (cluster: string, ...ids: string[]) => ids.map((id) => ({ id, lines: [id], cluster }));

/** Shaped like a 28-node serverless site: a gateway fanning out to four
 *  clusters of functions, most of which write one store, with a queue, a
 *  scheduler and alerting below them. One admin function also drives the
 *  scheduler, so a ranking that follows edge length alone puts it two ranks
 *  above the rest of its cluster. */
export const CLOUD: DiagramData = (() => {
  const plain = [
    ['browser', 'Reader or editor (browser)'],
    ['edge', 'Edge cache (routes, edge function, error page)'],
    ['gateway', 'HTTP gateway (routes, throttling)'],
    ['files', 'Object store: site files'],
    ['db', 'Object store: database'],
    ['jobs', 'Build jobs'],
    ['dead', 'Dead letters'],
    ['timer', 'Scheduler (one-shot and repeating)'],
    ['alerts', 'Alarms'],
    ['notify', 'Notifications'],
    ['secrets', 'Secret store (credentials)'],
    ['mail', 'Mail server'],
  ].map(([id, label]) => ({ id: id!, lines: [label!] }));
  const clustered = [
    ...fns('public', 'thumbs', 'short-links', 'sessions', 'replies', 'pingbacks', 'read-api'),
    ...fns('build', 'renderer', 'drafts'),
    ...fns('admin', 'admin-posts', 'admin-people', 'admin-config', 'admin-bulk'),
    ...fns('background', 'publish-later', 'mailer', 'cleanup', 'compact'),
  ];
  const clusters = ['public', 'build', 'admin', 'background'].map((id) => ({
    id, label: id[0]!.toUpperCase() + id.slice(1), members: clustered.filter((n) => n.cluster === id).map((n) => n.id),
  }));
  const e = (from: string, to: string, label?: string) => ({ from, to, ...(label !== undefined ? { label } : {}) });
  const routed = ['thumbs', 'short-links', 'sessions', 'replies', 'pingbacks', 'read-api', 'drafts',
    'admin-posts', 'admin-people', 'admin-config', 'admin-bulk'];
  const writers = ['short-links', 'sessions', 'replies', 'pingbacks', 'admin-posts', 'admin-people', 'admin-config',
    'admin-bulk', 'publish-later', 'mailer', 'cleanup', 'compact'];
  const edges = [
    e('browser', 'edge', 'HTTPS'), e('edge', 'files', 'pages, images'), e('edge', 'gateway', 'dynamic paths'),
    ...routed.map((to) => e('gateway', to)),
    ...writers.map((from) => e(from, 'db', 'rw')),
    ...['read-api', 'renderer', 'drafts'].map((from) => e(from, 'db', 'ro')),
    e('thumbs', 'files', 'rw'), e('renderer', 'files', 'rw'), e('admin-bulk', 'files', 'rw'),
    e('mailer', 'files', 'ro'), e('drafts', 'files', 'ro'),
    ...['admin-posts', 'admin-people', 'admin-config', 'admin-bulk', 'publish-later'].map((from) => e(from, 'jobs', 'build')),
    e('jobs', 'renderer', 'trigger'), e('jobs', 'dead', 'after 3 tries'),
    e('admin-posts', 'mailer', 'send'), e('admin-people', 'mailer', 'send'),
    e('timer', 'publish-later', 'one-shot'), e('timer', 'cleanup', 'daily'), e('timer', 'compact', '6-hourly'),
    e('admin-posts', 'timer', 'create one-shot'),
    e('mailer', 'mail', 'SMTP'), e('mailer', 'secrets', 'credential'),
    e('dead', 'alerts'), e('renderer', 'alerts'), e('gateway', 'alerts'), e('alerts', 'notify', 'notify'),
  ];
  return {
    nodes: [...plain, ...clustered.map(({ id, lines }) => ({ id, lines }))],
    edges,
    clusters,
  };
})();
