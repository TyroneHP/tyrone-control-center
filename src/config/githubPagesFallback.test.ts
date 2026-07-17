import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInContext, createContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

describe('GitHub Pages fallback', () => {
  it('redirects a deep link without redeclaring the browser location binding', () => {
    const fallbackHtml = readFileSync(
      join(process.cwd(), 'public', '404.html'),
      'utf8',
    )
    const fallbackScript = fallbackHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1]
    const replace = vi.fn()
    const context = createContext({
      window: {
        location: {
          hash: '',
          hostname: 'tyronehp.github.io',
          pathname: '/tyrone-control-center/setup',
          port: '',
          protocol: 'https:',
          replace,
          search: '',
        },
      },
    })

    expect(fallbackScript).toBeDefined()

    runInContext('const location = window.location', context)

    expect(() => runInContext(fallbackScript!, context)).not.toThrow()
    expect(replace).toHaveBeenCalledWith(
      'https://tyronehp.github.io/tyrone-control-center/?/setup',
    )
  })
})
