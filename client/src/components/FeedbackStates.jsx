import React from 'react'

export function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}

export function EmptyState({ title = 'No records found', description, actionLabel, onAction, icon = '📋' }) {
  return (
    <div className="card-nivaran p-8 sm:p-12 text-center my-4">
      <div className="text-4xl sm:text-5xl mb-3">{icon}</div>
      <h3 className="font-display font-bold text-sovereign-indigo text-lg mb-1">{title}</h3>
      {description && <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mb-5">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-primary text-sm">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function ErrorAlert({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="alert-error flex items-center justify-between gap-3 text-sm my-3">
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-bold underline hover:opacity-80"
        >
          Retry
        </button>
      )}
    </div>
  )
}
