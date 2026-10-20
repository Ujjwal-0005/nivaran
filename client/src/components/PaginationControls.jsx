import React from 'react'

/**
 * PaginationControls
 * Uniform, responsive pagination navigation bar for list pages.
 */
export default function PaginationControls({ page, totalPages, total, limit, onPageChange }) {
  if (!total || totalPages <= 1) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 bg-white border-t border-earthen-slate text-xs text-gray-600 rounded-b-lg">
      <div>
        Showing <span className="font-semibold text-gray-900">{start}</span> to{' '}
        <span className="font-semibold text-gray-900">{end}</span> of{' '}
        <span className="font-semibold text-gray-900">{total}</span> results
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded border border-earthen-slate bg-white text-gray-700 hover:bg-parchment disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
        >
          Previous
        </button>

        <span className="px-3 py-1 font-semibold text-sovereign-indigo bg-parchment rounded border border-earthen-slate">
          {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded border border-earthen-slate bg-white text-gray-700 hover:bg-parchment disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
        >
          Next
        </button>
      </div>
    </div>
  )
}
