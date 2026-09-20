// StatusBadge.jsx — shared component, used across citizen/staff/admin views
// Maps report status values to distinct colors and icons

const STATUS_CONFIG = {
  reported: {
    label: 'Reported',
    icon: '🔴',
    className: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  },
  acknowledged: {
    label: 'Acknowledged',
    icon: '👁️',
    className: 'bg-blue-100 text-blue-800 border border-blue-300',
  },
  in_progress: {
    label: 'In Progress',
    icon: '⚙️',
    className: 'bg-purple-100 text-purple-800 border border-purple-300',
  },
  resolved: {
    label: 'Resolved',
    icon: '✅',
    className: 'bg-green-100 text-green-800 border border-green-300',
  },
  disputed: {
    label: 'Disputed',
    icon: '⚠️',
    className: 'bg-orange-100 text-orange-800 border border-orange-300',
  },
}

function StatusBadge({ status, size = 'md' }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    icon: '❓',
    className: 'bg-gray-100 text-gray-800 border border-gray-300',
  }

  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : size === 'lg'
    ? 'px-4 py-1.5 text-sm'
    : 'px-3 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1 rounded font-medium ${sizeClass} ${config.className}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}

export default StatusBadge
