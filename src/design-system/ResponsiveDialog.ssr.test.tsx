// @vitest-environment node

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResponsiveDialog } from './ResponsiveDialog'

describe('ResponsiveDialog SSR', () => {
  it('renders no portal markup when initially open without document', () => {
    const markup = renderToString(
      <ResponsiveDialog onClose={() => undefined} open title="Dialogtitel">
        <p>Inhalt</p>
      </ResponsiveDialog>,
    )

    expect(markup).toBe('')
  })
})
