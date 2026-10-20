import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-sandstone flex items-center justify-center p-6">
      <div className="card-nivaran p-8 sm:p-12 max-w-md w-full text-center space-y-4">
        <span className="text-6xl">🏛️</span>
        <h1 className="font-display text-3xl font-bold text-sovereign-indigo">404</h1>
        <h2 className="text-lg font-semibold text-gray-800">Page Not Found</h2>
        <p className="text-gray-500 text-sm">
          The civic service or page you requested does not exist or may have been moved.
        </p>
        <div className="pt-3 flex justify-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary text-sm">
            Go Back
          </button>
          <button type="button" onClick={() => navigate('/')} className="btn-primary text-sm">
            Home
          </button>
        </div>
      </div>
    </div>
  )
}
