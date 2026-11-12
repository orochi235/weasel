export function noteNetworkChanged(): void;
export function networkChanged(): boolean;

export interface LoadReport {
  networkChanged: boolean;
  files: string[];
  otherFailures: boolean;
}

export interface ReportedModule {
  moduleId: string;
  state(): string;
  errors(): readonly unknown[];
  children: { allTests(): Iterable<{ result(): { state: string } }> };
}

export function loadReport(
  modules: Iterable<ReportedModule>,
  options: { root: string; networkChanged: boolean; unhandledErrors?: number; timeoutBudgetSpent?: boolean },
): LoadReport;

export function rerunPlan(reports: ReadonlyArray<LoadReport | null>): { files: string[]; settles: number[] };
