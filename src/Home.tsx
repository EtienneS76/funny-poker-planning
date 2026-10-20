import { useState } from 'react'
import { ArrowRight, Zap } from 'lucide-react'
import Topbar from './components/Topbar'
import ModalNewRefinement from './components/ModalNewRefinement'
import { useAppSnackbar } from './components/AppSnackbar'
import { useAccount } from './features/auth/useAccount'
import type { RefinementDraft } from './features/refinement/options'
import './styles/planning-poker.css'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useNavigate } from 'react-router'

export default function Home() {
  const navigate = useNavigate()
  const account = useAccount()
  const snackbar = useAppSnackbar()

  const [modalOpen, setModalOpen] = useState(false)

  const createRefinement = useMutation(api.refinement.mutations.create)

  const onSubmitNewRefinement = async (
    configuration: RefinementDraft,
    creatorName: string,
  ) => {
    try {
      if (!account.isAuthenticated) account.setGuestName(creatorName)
      const refinementSlug = await createRefinement({
        guestId: account.guestId,
        guestName: creatorName,
        universe: configuration.universe,
        sizing: configuration.sizing,
        issueUrl: configuration.issueUrl,
        funInteractionsEnabled: configuration.funInteractionsEnabled,
      })

      setModalOpen(false)
      navigate(`/refinement/${refinementSlug}`)
    } catch (error) {
      snackbar.error(
        'Création impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    }
  }

  function startQuickRefinement() {
    void onSubmitNewRefinement(
      {
        universe: 'default',
        sizing: 'fib',
        issueUrl: null,
        funInteractionsEnabled: true,
      },
      account.user?.username ?? account.guestName,
    )
  }

  return (
    <div className='multivers'>
      <Topbar account={account} />
      <main className='pp-home'>
        <div className='poker-hand' aria-hidden='true'>
          <div className='poker-card poker-card--left'>3</div>
          <div className='poker-card poker-card--center'>5</div>
          <div className='poker-card poker-card--right'>8</div>
        </div>
        <div className='pp-home-copy'>
          <h1>Estimez vos tickets de manière ludique.</h1>
          <p>Une expérience interactive pour estimer vos tickets.</p>
        </div>
        <div className='pp-home-actions'>
          <button
            className='pp-button pp-button--launch'
            onClick={() => setModalOpen(true)}
          >
            Lancer un refinement <ArrowRight size={21} aria-hidden='true' />
          </button>
          <button
            className='pp-button pp-button--secondary pp-button--quick'
            onClick={startQuickRefinement}
          >
            <Zap size={19} aria-hidden='true' /> Refinement classique
          </button>
        </div>
      </main>
      <footer className='pp-home-credit'>
        <span>
          Crafted with{' '}
          <span role='img' aria-label='amour'>
            ❤️
          </span>{' '}
          by{' '}
        </span>
        <a
          href='https://github.com/EtienneS76/funny-poker-planning'
          target='_blank'
          rel='noopener noreferrer'
        >
          Etienne
        </a>
      </footer>
      {modalOpen && (
        <ModalNewRefinement
          account={account}
          onClose={() => setModalOpen(false)}
          onSubmit={onSubmitNewRefinement}
        />
      )}
    </div>
  )
}
