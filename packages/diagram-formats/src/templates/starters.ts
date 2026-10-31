/** The Mermaid each sequence and chart template starts from: small, but showing what its kind draws. */
import type { PlotKind } from '@weasel-js/plot';

export const SEQUENCE_STARTER = `sequenceDiagram
  participant Client
  participant Server
  Client->>Server: Request
  Server-->>Client: Response
`;

/** One per chart kind, with the label a menu calls it. */
export const PLOT_STARTERS: Readonly<Record<PlotKind, { label: string; source: string }>> = {
  xychart: {
    label: 'XY chart',
    source: `xychart-beta
  title "Sales"
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "Revenue" 0 --> 100
  bar [40, 55, 70, 62]
  line [40, 55, 70, 62]
`,
  },
  gantt: {
    label: 'Gantt',
    source: `gantt
  dateFormat YYYY-MM-DD
  section Plan
    Scope :a1, 2026-01-05, 5d
    Design :a2, after a1, 7d
  section Build
    Implement :b1, after a2, 10d
    Release :milestone, after b1, 0d
`,
  },
  timeline: {
    label: 'Timeline',
    source: `timeline
  title Milestones
  2024 : Founded
  2025 : First release : First customer
  2026 : Second release
`,
  },
  pie: {
    label: 'Pie',
    source: `pie
  title Share
  "Alpha" : 45
  "Beta" : 30
  "Gamma" : 25
`,
  },
  quadrant: {
    label: 'Quadrant',
    source: `quadrantChart
  title Effort and impact
  x-axis Low Effort --> High Effort
  y-axis Low Impact --> High Impact
  quadrant-1 Plan
  quadrant-2 Do now
  quadrant-3 Skip
  quadrant-4 Delegate
  Idea A: [0.3, 0.7]
  Idea B: [0.7, 0.8]
  Idea C: [0.6, 0.3]
`,
  },
  journey: {
    label: 'User journey',
    source: `journey
  title Getting started
  section Sign up
    Find the site: 4: User
    Create an account: 3: User
  section First use
    Make something: 5: User
`,
  },
  gitgraph: {
    label: 'Git graph',
    source: `gitGraph
  commit
  branch feature
  commit
  checkout main
  commit
  merge feature
`,
  },
  sankey: {
    label: 'Sankey',
    source: `sankey-beta
Source A,Middle,30
Source B,Middle,20
Middle,Out X,35
Middle,Out Y,15
`,
  },
  packet: {
    label: 'Packet',
    source: `packet-beta
  0-15: "Source"
  16-31: "Destination"
  32-63: "Payload"
`,
  },
  radar: {
    label: 'Radar',
    source: `radar-beta
  axis a["Speed"], b["Cost"], c["Quality"], d["Reach"]
  curve x["Plan A"]{4, 3, 5, 2}
  curve y["Plan B"]{3, 4, 2, 5}
  max 5
  min 0
`,
  },
};
