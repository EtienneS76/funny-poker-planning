import { useParams, useSearchParams } from 'react-router'
import { useRoomViewModel } from './hooks/useRoomViewModel'
import { getTheme } from './themes/registry'

/** Page de salle : logique partagée (view model) + thème choisi par l'univers du refinement. */
export function RefinementRoom() {
  const { refinementSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const vm = useRoomViewModel(refinementSlug)
  // ?theme=pk permet de prévisualiser un thème avant que l'univers soit stocké à la création
  const theme = getTheme(searchParams.get('theme') ?? vm.universe)
  return <theme.Room vm={vm} themeId={theme.id} />
}
