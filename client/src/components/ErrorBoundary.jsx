import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-sandstone flex items-center justify-center p-6">
          <div className="card-nivaran p-8 max-w-md w-full text-center space-y-4">
            <span className="text-5xl">⚠️</span>
            <h1 className="font-display text-xl font-bold text-sovereign-indigo">Something went wrong</h1>
            <p className="text-gray-500 text-sm">
              An unexpected error occurred while rendering this page.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="btn-primary text-sm w-full"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
