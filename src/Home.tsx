import { useState } from 'react'
import { ArrowRight, Store } from 'lucide-react'
import Topbar from './components/Topbar'
import ModalNewRefinement from './components/ModalNewRefinement'
import ModalShop from './components/ModalShop'
import { useAppSnackbar } from './components/AppSnackbar'
import { useAccount } from './features/auth/useAccount'
import type { RefinementDraft } from './features/refinement/options'
import './styles/planning-poker.css'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useNavigate } from 'react-router'

export default function Home() {
  const navigate = useNavigate()
  const account = useAccount()
  const snackbar = useAppSnackbar()

  const [modalOpen, setModalOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)

  const createRefinement = useMutation(api.refinement.mutations.create)
  const shopData = useQuery(api.user.queries.shopData, {})

  const onSubmitNewRefinement = async (
    configuration: RefinementDraft,
    creatorName: string,
  ) => {
    try {
      if (!account.isAuthenticated) account.setGuestName(creatorName)
      const refinementSlug = await createRefinement({
        guestId: account.guestId,
        guestName: creatorName,
        sizing: configuration.sizing,
        issueUrl: configuration.issueUrl,
      })

      setModalOpen(false)
      snackbar.success('Partie créée', 'La salle est prête à rejoindre.')
      navigate(`/refinement/${refinementSlug}`)
    } catch (error) {
      snackbar.error(
        'Création impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
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
          <h1>Estimez vos tickets en équipe.</h1>
          <p>Un planning poker classique, prêt à lancer avec votre équipe.</p>
        </div>
        <div className='pp-home-actions'>
          <button
            className='pp-button pp-button--launch'
            onClick={() => setModalOpen(true)}
          >
            Lancer un refinement <ArrowRight size={21} aria-hidden='true' />
          </button>
          <button
            className='pp-button pp-button--secondary pp-button--shop'
            onClick={() => setShopOpen(true)}
          >
            <Store size={19} aria-hidden='true' /> Boutique
          </button>
        </div>
      </main>
      {modalOpen && (
        <ModalNewRefinement
          account={account}
          onClose={() => setModalOpen(false)}
          onSubmit={onSubmitNewRefinement}
        />
      )}
      {shopOpen && (
        <ModalShop
          balance={shopData?.balance ?? 0}
          catalog={shopData?.catalog ?? []}
          ownedIds={shopData?.ownedIds ?? []}
          isAuthenticated={account.isAuthenticated}
          canSignIn={
            account.configured === true && !account.loading && !account.pending
          }
          onSignIn={() => void account.signIn()}
          onClose={() => setShopOpen(false)}
        />
      )}
    </div>
  )
}
