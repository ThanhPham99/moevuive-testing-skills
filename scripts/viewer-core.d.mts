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
  rows: string[][]
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
  headers: readonly string[]
  colWidths?: readonly number[]
  rows: unknown[][]
}

export interface ExportPlan {
  base: string
  csvHeaders: readonly string[]
  csvRows: unknown[][]
  sheets: ExportSheet[]
}

export const PRIORITY_ORDER: Record<string, number>
export const RISK_ORDER: Record<string, number>
export const EXPORT_COLUMNS: readonly string[]

export function splitCells(line: string): string[]
export function formatCellPlainText(raw: string): string
export function parseMarkdownTables(content: string): MarkdownTable[]
export function parseMarkdownFile(fileName: string, content: string): ParsedFile
export function compareTcId(a: string, b: string): number
export function compareText(a: string, b: string): number
export function buildGroupScopeKey(fileName: string, group?: string): string
export function parseGroupScopeKey(scopeKey: string): { fileName: string; group: string }
export function queryTestCases(parsedFiles: ParsedFile[], query?: TestCaseQuery): TestCaseQueryResult
export function buildTestCasesExportPlan(cases: TestCase[], baseName: string): ExportPlan
export function buildCsvString(plan: ExportPlan): string
export function buildXlsxBytes(plan: ExportPlan): Uint8Array
export function formatExportTimestamp(date?: Date): string
