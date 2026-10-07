// StatusBadge.jsx — shared component used across all Nivaran portals
// Design tokens applied; "stamp/seal" motif for resolved state

const STATUS_CONFIG = {
  reported: {
    label: 'Reported',
    hi: 'दर्ज',
    icon: '📋',
    className: 'bg-amber-50 text-amber-800 border border-amber-300',
  },
  acknowledged: {
    label: 'Acknowledged',
    hi: 'स्वीकृत',
    icon: '👁️',
    className: 'bg-blue-50 text-blue-800 border border-blue-300',
  },
  in_progress: {
    label: 'In Progress',
    hi: 'जारी है',
    icon: '⚙️',
    className: 'bg-violet-50 text-violet-800 border border-violet-300',
  },
  resolved: {
    label: 'Resolved',
    hi: 'निवारण',
    icon: '✦',
    // Uses .stamp-resolved utility class defined in index.css
    className: 'stamp-resolved',
    isStamp: true,
  },
  disputed: {
    label: 'Disputed',
    hi: 'विवादित',
    icon: '⚠️',
    className: 'bg-orange-50 text-orange-800 border border-orange-300',
  },
  escalated: {
    label: 'Escalated',
    hi: 'वृद्धि',
    icon: '🚨',
    className: 'bg-red-50 text-terracotta-alert border border-red-300 animate-pulse',
  },
}

/**
 * @param {{ status: string, size?: 'sm'|'md'|'lg', showHindi?: boolean }} props
 */
function StatusBadge({ status, size = 'md', showHindi = false }) {
  const config = STATUS_CONFIG[status] || {
    label: status?.replace('_', ' ') || 'Unknown',
    icon: '❓',
    className: 'bg-gray-100 text-gray-700 border border-gray-300',
  }

  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs gap-1'
      : size === 'lg'
      ? 'px-4 py-1.5 text-sm gap-1.5'
      : 'px-2.5 py-1 text-xs gap-1'

  return (
    <span
      className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${config.className}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
      {showHindi && config.hi && (
        <span className="opacity-60 font-normal ml-0.5 text-[10px]">({config.hi})</span>
      )}
    </span>
  )
}

export default StatusBadge
