import {
  defaultMobileTabs,
  isPinnableNavigationId,
  navigationById,
  navigationItems,
} from './navigation'

describe('navigation catalog', () => {
  it('owns ten unique German destinations with stable IDs', () => {
    expect(navigationItems).toHaveLength(10)
    expect(new Set(navigationItems.map((item) => item.id))).toHaveProperty(
      'size',
      10,
    )
    expect(navigationById.get('overview')).toMatchObject({
      label: '\u00dcbersicht',
      path: '/',
    })
    expect(navigationById.get('settings')?.label).toBe('Einstellungen')
  })

  it('defines three distinct defaults and rejects fixed controls', () => {
    expect(defaultMobileTabs).toEqual(['calendar', 'tasks', 'training'])
    expect(new Set(defaultMobileTabs).size).toBe(3)
    expect(isPinnableNavigationId('overview')).toBe(false)
    expect(isPinnableNavigationId('more')).toBe(false)
    expect(isPinnableNavigationId('settings')).toBe(true)
  })
})
