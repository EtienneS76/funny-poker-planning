import type { RoomProps } from '../types'
import { StarWarsFactionLayer } from './StarWarsFactionLayer'
import { StarWarsSkirmishLayer } from './StarWarsSkirmishLayer'

/** Couches du thème Star Wars : switch de camp + escarmouche. */
export function StarWarsLayer(props: RoomProps) {
  return (
    <>
      <StarWarsFactionLayer />
      <StarWarsSkirmishLayer
        key={props.vm.skirmish.refinementSlug}
        {...props}
      />
    </>
  )
}
