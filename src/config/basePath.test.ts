import { describe, expect, it } from 'vitest'
import { getViteBasePath } from './basePath'

describe('getViteBasePath', () => {
  it('uses the repository path in production', () => {
    expect(getViteBasePath('production')).toBe('/tyrone-control-center/')
  })

  it('uses the root path outside production', () => {
    expect(getViteBasePath('development')).toBe('/')
  })
})
