import { useState } from 'react'
import { ArrowRight, Pencil } from 'lucide-react'
import Topbar from './components/Topbar'
import ModalNewRefinement from './components/ModalNewRefinement'
import { useAccount } from './features/auth/useAccount'
import {
  sizings,
  universes,
  type RefinementDraft,
} from './features/refinement/options'
import './styles/planning-poker.css'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useNavigate } from 'react-router'
import { useSnackbar } from 'notistack'

export default function Home() {
  const navigate = useNavigate()
  const account = useAccount()

  const { enqueueSnackbar } = useSnackbar()

  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<RefinementDraft | null>(null)

  const createRefinement = useMutation(api.refinement.mutations.create)

  const onSubmitNewRefinement = async (configuration: RefinementDraft) => {
    try {
      const refinementSlug = await createRefinement({
        name: configuration.name,
      })

      setDraft(configuration)
      setModalOpen(false)
      enqueueSnackbar('Refinement créé avec succès', { variant: 'success' })
      navigate(`/refinement/${refinementSlug}`)
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error
          ? `Échec de la création : ${error.message}`
          : 'Échec de la création du refinement.',
        { variant: 'error' },
      )
    }
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
          <h1>Estimez vos tickets dans l’univers de votre choix.</h1>
          <p>
            Un planning poker où chaque refinement vous immerge dans l'univers
            de Pokémon, Harry Potter, Star Wars et plus encore.
          </p>
        </div>
        <button
          className='pp-button pp-button--launch'
          onClick={() => setModalOpen(true)}
        >
          Lancer un refinement <ArrowRight size={21} aria-hidden='true' />
        </button>
        {draft && (
          <section
            className='refinement-draft'
            aria-label='Brouillon de refinement'
          >
            <div role='status'>
              <span className='draft-caption'>Brouillon de refinement</span>
              <h2>{draft.name}</h2>
              <p>
                {
                  universes.find((option) => option.id === draft.universe)
                    ?.label
                }{' '}
                · {sizings.find((option) => option.id === draft.sizing)?.label}
              </p>
              {draft.issueUrl && (
                <a
                  href={draft.issueUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Issue GitHub
                </a>
              )}
            </div>
            <button
              className='pp-icon-button'
              aria-label='Modifier le brouillon'
              title='Modifier le brouillon'
              onClick={() => setModalOpen(true)}
            >
              <Pencil size={18} />
            </button>
          </section>
        )}
      </main>
      {modalOpen && (
        <ModalNewRefinement
          account={account}
          initialDraft={draft}
          onClose={() => setModalOpen(false)}
          onSubmit={onSubmitNewRefinement}
        />
      )}
    </div>
  )
}
