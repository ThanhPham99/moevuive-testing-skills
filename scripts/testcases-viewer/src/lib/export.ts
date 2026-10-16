// Xuất test cases ra CSV và Excel (.xlsx) qua module lõi `scripts/viewer-core.mjs`.

import {
  EXPORT_COLUMNS as CORE_EXPORT_COLUMNS,
  buildCsvString,
  buildTestCasesExportPlan,
  buildXlsxBytes,
  formatExportTimestamp,
} from '../../../viewer-core.mjs'
import type { TestCase } from './parser.ts'

export const EXPORT_COLUMNS = CORE_EXPORT_COLUMNS as readonly [
  'TC ID',
  'REQ ID',
  'Module',
  'Risk Level',
  'Test Scenario',
  'Pre-Condition',
  'Test Steps',
  'Test Data',
  'Expected Result',
  'Priority',
  'Automatable',
  'Auto Type',
  'Tags',
]

function download(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportCsv(cases: TestCase[], baseName: string): void {
  const plan = buildTestCasesExportPlan(cases, baseName)
  const csv = buildCsvString(plan)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  download(`${plan.base}_${formatExportTimestamp()}.csv`, blob)
}

export function exportXlsx(cases: TestCase[], baseName: string): void {
  const plan = buildTestCasesExportPlan(cases, baseName)
  const bytes = buildXlsxBytes(plan)
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  download(`${plan.base}_${formatExportTimestamp()}.xlsx`, blob)
}
