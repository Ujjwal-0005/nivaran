// Shared department → color mapping used across all Nivaran portals

export const DEPT_COLORS = {
  'Public Works': { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9', dot: '#1565C0' },
  'Sanitation': { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7', dot: '#2E7D32' },
  'Electricity': { bg: '#FFFDE7', text: '#F57F17', border: '#FFF176', dot: '#F57F17' },
  'Water Supply': { bg: '#E1F5FE', text: '#0277BD', border: '#81D4FA', dot: '#0277BD' },
  'Transport': { bg: '#F3E5F5', text: '#6A1B9A', border: '#CE93D8', dot: '#6A1B9A' },
  'Health': { bg: '#FCE4EC', text: '#AD1457', border: '#F48FB1', dot: '#AD1457' },
  'Parks & Gardens': { bg: '#F1F8E9', text: '#558B2F', border: '#C5E1A5', dot: '#558B2F' },
}

// Default for unknown departments
const DEFAULT_COLOR = { bg: '#EEF2FF', text: '#0B2545', border: '#C7D2FE', dot: '#0B2545' }

/**
 * Returns colour tokens for a department name.
 * @param {string|undefined} deptName
 * @returns {{ bg: string, text: string, border: string, dot: string }}
 */
export function getDeptColor(deptName) {
  if (!deptName) return DEFAULT_COLOR
  return DEPT_COLORS[deptName] ?? DEFAULT_COLOR
}

/**
 * Returns an inline style object for a dept-coloured left-border card accent.
 * @param {string|undefined} deptName
 */
export function getDeptBorderStyle(deptName) {
  const color = getDeptColor(deptName)
  return { borderLeftColor: color.dot, borderLeftWidth: '4px' }
}
