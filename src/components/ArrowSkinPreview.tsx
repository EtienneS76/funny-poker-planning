import '../styles/arrow-skins.css'

type ArrowSkinPreviewProps = {
  skin: { id: string; name: string }
}

/** Vignette (statique) d'une flèche cosmétique du thème « Tir à l'arc ». */
export function ArrowSkinPreview({ skin }: ArrowSkinPreviewProps) {
  return (
    <div
      className='pp-arrow-preview'
      data-arrow-skin={skin.id}
      role='img'
      aria-label={`Aperçu : ${skin.name}`}
    >
      <svg viewBox='0 0 120 120' aria-hidden='true'>
        <g transform='rotate(-35 60 60)'>
          {skin.id === 'fire' && (
            <>
              <path d='M0 60c14-22 46-18 66-4-22-2-36 12-66 4z' fill='#ff7a1f' />
              <path d='M10 60c10-13 30-11 46-4-16 0-24 7-46 4z' fill='#ffc23d' />
              <circle cx='14' cy='40' r='3' fill='#ff8a1e' />
              <circle cx='34' cy='34' r='2.2' fill='#ffc23d' />
              <circle cx='24' cy='80' r='2.4' fill='#ff5a1f' />
            </>
          )}
          {skin.id === 'ice' && (
            <>
              <path d='M2 60l60-9v18z' fill='#c9f0ff' />
              <path
                d='M16 36l5 8-5 8-5-8zM38 30l4 6-4 6-4-6zM26 74l5 8-5 8-5-8zM50 78l3 5-3 5-3-5z'
                fill='#8fdcff'
              />
            </>
          )}
          {skin.id === 'rainbow' && (
            <g opacity='.9'>
              <path d='M4 46h62v4H4z' fill='#e5484d' />
              <path d='M4 50h62v4H4z' fill='#f08c00' />
              <path d='M4 54h62v4H4z' fill='#f2c200' />
              <path d='M4 62h62v4H4z' fill='#46a758' />
              <path d='M4 66h62v4H4z' fill='#3e7bfa' />
              <path d='M4 70h62v4H4z' fill='#8e4ec6' />
            </g>
          )}
          <path className='pp-arrow-preview-shaft' d='M26 60h66' />
          <path
            className='pp-arrow-preview-feather'
            d='M20 52l10 8-10 8M29 52l10 8-10 8'
          />
          <path className='pp-arrow-preview-head' d='M108 60l-18-9v18z' />
          {skin.id === 'dragon' && (
            // deux dragons d'esprit enroulés autour de la hampe
            <g fill='none' strokeLinecap='round'>
              <path
                d='M4 60q11-22 22 0t22 0 22 0 22 0'
                stroke='#49b6ff'
                strokeWidth='6'
              />
              <path
                d='M4 60q11 22 22 0t22 0 22 0 22 0'
                stroke='#9fe8ff'
                strokeWidth='6'
              />
              <circle cx='96' cy='52' r='7' fill='#49b6ff' />
              <circle cx='96' cy='68' r='7' fill='#9fe8ff' />
              <circle cx='99' cy='51' r='1.8' fill='#fff' />
              <circle cx='99' cy='67' r='1.8' fill='#fff' />
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}
