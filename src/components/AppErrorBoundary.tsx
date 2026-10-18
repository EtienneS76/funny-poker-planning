import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, House, RotateCcw } from 'lucide-react'
import { Link } from 'react-router'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return {
      error: error instanceof Error ? error : new Error('Erreur inattendue.'),
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed', error, info.componentStack)
  }

  render() {
    const { error } = this.state

    if (error) {
      return (
        <main className='pp-error-page' role='alert'>
          <div className='pp-error-icon' aria-hidden='true'>
            <AlertTriangle size={30} />
          </div>
          <p className='pp-error-kicker'>Une erreur est survenue</p>
          <h1>Cette page n’a pas pu se charger.</h1>
          <p className='pp-error-message'>
            Un problème technique a interrompu le chargement. Tu peux réessayer
            ou revenir à l’accueil.
          </p>
          <div className='pp-error-actions'>
            <button
              className='pp-button'
              type='button'
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={18} aria-hidden='true' />
              Réessayer
            </button>
            <Link className='pp-error-home' to='/'>
              <House size={18} aria-hidden='true' />
              Retour à l’accueil
            </Link>
          </div>
          <details className='pp-error-details'>
            <summary>Détails techniques</summary>
            <pre>{error.message}</pre>
          </details>
        </main>
      )
    }

    return this.props.children
  }
}
