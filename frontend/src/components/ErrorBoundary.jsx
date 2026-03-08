import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.warn('Component error caught by boundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="card bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {this.props.label || 'This section'} could not be displayed.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
