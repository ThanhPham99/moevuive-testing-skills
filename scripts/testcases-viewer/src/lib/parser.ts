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
import type {
  MarkdownTable,
  ParsedFile,
  SortKey,
  TestCase,
  TestCaseQuery,
  TestCaseQueryResult,
} from '../../../viewer-core.mjs'

export type { MarkdownTable, ParsedFile, SortKey, TestCase, TestCaseQuery, TestCaseQueryResult }

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
