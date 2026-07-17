import { describe, expect, it } from 'vitest'
import { createAppQueryClient } from './queryClient'

describe('createAppQueryClient', () => {
  it('uses the planned query and mutation retry defaults', () => {
    const options = createAppQueryClient().getDefaultOptions()

    expect(options.queries?.staleTime).toBe(5 * 60 * 1000)
    expect(options.queries?.retry).toBe(1)
    expect(options.mutations?.retry).toBe(false)
  })
})
