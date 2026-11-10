import type { CSSProperties } from 'react'

type CardDesignPreviewProps = {
  design: { id: string; name: string; symbol: string }
  className?: string
  /** Vignette : une seule face et le dos, pour les cartes compactes. */
  compact?: boolean
}

const previewValues = [1, 2, 3, 5, 8, 13, 21]

export function CardDesignPreview({
  design,
  className,
  compact = false,
}: CardDesignPreviewProps) {
  if (compact)
    return (
      <div
        className='pp-card-design-preview pp-card-design-preview--compact'
        data-card-design={design.id}
        role='img'
        aria-label={`Aperçu du design ${design.name}`}
      >
        <span className='pp-design-card pp-design-card--face' aria-hidden='true'>
          <b>8</b>
          {design.id === 'golden-eclipse' && <i />}
        </span>
        <span className='pp-design-card pp-design-card--back' aria-hidden='true'>
          <b>{design.symbol}</b>
          {design.id === 'golden-eclipse' && <i />}
        </span>
      </div>
    )
  return (
    <div
      className={`pp-card-design-preview${className ? ` ${className}` : ''}`}
      data-card-design={design.id}
      aria-label={`Aperçu du design ${design.name}`}
    >
      <div className='pp-card-design-fan' aria-hidden='true'>
        {previewValues.map((value, index) => {
          const offset = index - 3
          return (
            <span
              className='pp-design-card pp-design-card--face'
              key={value}
              style={
                {
                  '--card-turn': `${offset * 6}deg`,
                  '--card-lift': `${Math.abs(offset) * 4}px`,
                } as CSSProperties
              }
            >
              <b>{value}</b>
              {design.id === 'golden-eclipse' && <i />}
            </span>
          )
        })}
      </div>
      <div className='pp-card-design-back-preview'>
        <span className='pp-design-card pp-design-card--back' aria-hidden='true'>
          <b>{design.symbol}</b>
          {design.id === 'golden-eclipse' && <i />}
        </span>
        <small>Dos pendant le vote</small>
      </div>
    </div>
  )
}