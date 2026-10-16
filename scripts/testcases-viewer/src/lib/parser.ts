// Deep TestCase Catalog & Offline Report Viewer Markdown Table Module (`src/lib/parser.ts`)
// Delegates in-process parsing and querying to the unified `scripts/viewer-core.mjs` module.

import {
  PRIORITY_ORDER as CORE_PRIORITY_ORDER,
  RISK_ORDER as CORE_RISK_ORDER,
  buildGroupScopeKey as coreBuildGroupScopeKey,
  compareTcId as coreCompareTcId,
  compareText as coreCompareText,
  formatCellPlainText as coreFormatCellPlainText,
  parseGroupScopeKey as coreParseGroupScopeKey,
  parseMarkdownFile as coreParseMarkdownFile,
  parseMarkdownTables as coreParseMarkdownTables,
  queryTestCases as coreQueryTestCases,
  splitCells as coreSplitCells,
} from '../../../viewer-core.mjs'

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

export const PRIORITY_ORDER: Record<string, number> = CORE_PRIORITY_ORDER
export const RISK_ORDER: Record<string, number> = CORE_RISK_ORDER

export function splitCells(line: string): string[] {
  return coreSplitCells(line)
}

export function formatCellPlainText(raw: string): string {
  return coreFormatCellPlainText(raw)
}

export function parseMarkdownTables(content: string): MarkdownTable[] {
  return coreParseMarkdownTables(content)
}

export function parseMarkdownFile(fileName: string, content: string): ParsedFile {
  return coreParseMarkdownFile(fileName, content)
}

export function compareTcId(a: string, b: string): number {
  return coreCompareTcId(a, b)
}

export function compareText(a: string, b: string): number {
  return coreCompareText(a, b)
}

export function buildGroupScopeKey(fileName: string, group = ''): string {
  return coreBuildGroupScopeKey(fileName, group)
}

export function parseGroupScopeKey(scopeKey: string): { fileName: string; group: string } {
  return coreParseGroupScopeKey(scopeKey)
}

export function queryTestCases(
  parsedFiles: ParsedFile[],
  query: TestCaseQuery = {}
): TestCaseQueryResult {
  return coreQueryTestCases(parsedFiles, query)
}
