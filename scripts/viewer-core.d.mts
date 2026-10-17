export interface TestCase {
  uid: string
  id: string
  reqIds: string[]
  module: string
  risk: string
  title: string
  preCondition: string
  steps: string
  testData: string
  expected: string
  priority: string
  automatable: string
  autoType: string
  tags: string[]
  group: string
  sourceFile: string
}

export interface ParsedFile {
  fileName: string
  docTitle: string
  testCases: TestCase[]
}

export interface MarkdownTable {
  heading: string
  headers: string[]
  header: string[]
  rows: string[][]
}

export interface ExecutionTrendRow {
  grp: string
  id: string
  module: string
  seq: Array<{ run: string; st: string }>
}

export type SortKey = 'id' | 'title' | 'priority' | 'risk' | 'group'

export interface TestCaseQuery {
  search?: string
  priorities?: Set<string> | string[]
  automatable?: string
  tag?: string
  scopeKey?: string
  sort?: { key: SortKey; dir: 1 | -1 }
}

export interface TestCaseQueryResult {
  allCases: TestCase[]
  filtered: TestCase[]
  allTags: string[]
  stats: Record<string, number>
  exportBaseName: string
}

export interface ExportSheet {
  name: string
  statusCol?: number
  statusCols?: readonly number[]
  widths?: readonly number[]
  head: readonly string[]
  rows: unknown[][]
}

export interface ExportPlan {
  base: string
  sheets: ExportSheet[]
}

export interface ZipFileEntry {
  name: string
  content: string
}

export const STATUS_MAP: ReadonlyArray<readonly [RegExp, string]>
export const PLACEHOLDER_RE: RegExp
export const PRIORITY_ORDER: Record<string, number>
export const RISK_ORDER: Record<string, number>
export const EXPORT_COLUMNS: readonly string[]
export const TESTCASE_COLUMN_WIDTHS: readonly number[]
export const SEV_MAP: ReadonlyArray<readonly [RegExp, string]>
export const SEV_LABEL: Record<string, string>
export const ST_LABEL: Record<string, string>
export const ALL_BUG_ST: readonly string[]
export const ALL_BUG_SV: readonly string[]
export const ALL_BUG_PR: readonly string[]
export const BUG_RANKS: Record<string, Record<string, number>>
export const RTM_ST: Record<string, string>
export const GRP_LABEL: Record<string, string>
export const XLSX_STATUS_STYLES: Record<string, number>
export const STYLES_XML: string

export function normStatus(raw: unknown): string
export function cleanCell(s: unknown): string
export function formatCellPlainText(raw: string): string
export function stripInline(s: unknown): string
export function stripMd(s: unknown): string
export function splitCells(line: string): string[]
export function isSeparatorRow(line: string): boolean
export function cleanGroupName(raw: string): string
export function parseMarkdownTables(
  contentOrLines: string | string[],
  options?: { ignoreCodeFences?: boolean }
): MarkdownTable[]
export function colIdx(header: string[], re: RegExp): number
export function splitSections(text: string): Record<string, string[]>
export function extractBoldKV(lines: string[]): Record<string, string>
export function compareTcId(a: string, b: string): number
export function compareText(a: string, b: string): number
export function rowComparator<T extends Record<string, unknown>>(
  key: string,
  dir: 1 | -1,
  ranks?: Record<string, Record<string, number>>,
  valueAccessor?: ((row: T, key: string) => unknown) | null
): (a: T, b: T) => number
export function buildGroupScopeKey(fileName: string, group?: string): string
export function parseGroupScopeKey(scopeKey: string): { fileName: string; group: string }
export function parseMarkdownFile(fileName: string, content: string): ParsedFile
export function queryTestCases(parsedFiles: ParsedFile[], query?: TestCaseQuery): TestCaseQueryResult
export function buildTestCasesExportPlan(cases: TestCase[], baseName?: string): ExportPlan
export function classifyBugStatus(rawStatus: unknown): string
export function isBugFile(text: string): boolean
export function parseBugFile(text: string, fileName: string): Record<string, unknown>
export function parseBugIndex(text: string, fileName: string): {
  rows: Array<Record<string, unknown>>
  meta: Record<string, string>
}
export function dedupeBugs(docs: Array<Record<string, unknown>>): Array<Record<string, unknown>>
export function queryBugsCatalog(
  docs: Array<Record<string, unknown>>,
  query?: Record<string, unknown>
): Record<string, unknown>
export function buildBugsExportPlan(rows: Array<Record<string, unknown>>): ExportPlan
export function parseRtm(
  tables: MarkdownTable[],
  fileName: string,
  title: string
): Record<string, unknown>
export function parseTestSummary(
  rawOrTables: string | MarkdownTable[],
  nameOrLines?: string | string[],
  maybeFileName?: string,
  maybeTitle?: string
): Record<string, unknown>
export function parseExecutionReport(text: string, fileName: string): Record<string, unknown>
export function extractPrimaryIds(rawText: string, regex: RegExp): string[]
export function mapRetestBugStatusToTcStatus(bugStatus: string): string
export function extractDocTcStatusMap(d: Record<string, unknown>): Map<string, string>
export function compareRunOrder(a: unknown, b: unknown): number
export function computeExecutionTrend(docs: Array<Record<string, unknown>>): ExecutionTrendRow[]
export function buildExecutionExportPlan(arg?: Record<string, unknown>): ExportPlan
export function formatExportTimestamp(date?: Date): string
export function buildCsvString(planOrHead: ExportPlan | readonly string[], maybeRows?: unknown[][]): string
export function crc32(bytes: Uint8Array): number
export function zipStoreBytes(files: ZipFileEntry[]): Uint8Array
export function xmlEscape(s: unknown): string
export function colLetter(index: number): string
export function resolveXlsxStatusStyle(val: unknown): number | undefined
export function buildSheetXml(sh: ExportSheet): string
export function safeSheetName(raw: string, taken?: Set<string>): string
export function buildXlsxFiles(planOrSheets: ExportPlan | readonly ExportSheet[]): ZipFileEntry[]
export function buildXlsxBytes(planOrSheets: ExportPlan | readonly ExportSheet[]): Uint8Array
export const EVIDENCE_IMG_RE: RegExp
export function evidenceBaseName(p: unknown): string
export function extractEvidenceImages(
  raw: unknown,
  imagesMap?: { has(k: string): boolean } | string[] | Record<string, unknown> | null
): {
  items: Array<{ path: string; baseName: string; loaded: boolean }>
  missingCount: number
}
export function escapeHtml(s: unknown): string
export function renderEvidenceHtml(
  raw: unknown,
  imagesMap?: { has(k: string): boolean } | string[] | Record<string, unknown> | null,
  mode?: 'bugs' | 'execution'
): string
