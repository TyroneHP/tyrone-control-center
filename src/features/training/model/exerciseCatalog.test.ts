import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseIllustration } from '../components/ExerciseIllustration'
import {
  STANDARD_EXERCISES,
  exerciseById,
  getExerciseDefinition,
} from './exerciseCatalog'

const REQUIRED_EXERCISE_IDS = [
  'bench-press',
  'incline-bench-press',
  'dumbbell-bench-press',
  'incline-dumbbell-press',
  'machine-chest-press',
  'pec-deck',
  'cable-fly',
  'lat-pulldown',
  'close-grip-lat-pulldown',
  'pull-up',
  't-bar-row',
  'seated-cable-row',
  'chest-supported-row',
  'barbell-row',
  'one-arm-dumbbell-row',
  'straight-arm-pulldown',
  'face-pull',
  'back-squat',
  'leg-press',
  'romanian-deadlift',
  'conventional-deadlift',
  'hack-squat',
  'bulgarian-split-squat',
  'walking-lunge',
  'leg-extension',
  'seated-leg-curl',
  'lying-leg-curl',
  'hip-thrust',
  'standing-calf-raise',
  'seated-calf-raise',
  'machine-shoulder-press',
  'dumbbell-shoulder-press',
  'dumbbell-lateral-raise',
  'cable-lateral-raise',
  'reverse-pec-deck',
  'rear-delt-cable-fly',
  'front-raise',
  'barbell-curl',
  'dumbbell-curl',
  'hammer-curl',
  'preacher-curl',
  'cable-curl',
  'rope-pushdown',
  'katana-triceps-extension',
  'overhead-cable-triceps-extension',
  'dip',
  'machine-crunch',
  'cable-crunch',
  'hanging-leg-raise',
  'plank',
] as const

const exerciseAssetDirectory = resolve('public/training/exercises')

interface SvgPoint {
  x: number
  y: number
}

function readExerciseSvg(exerciseId: string) {
  const markup = readFileSync(
    resolve(exerciseAssetDirectory, `${exerciseId}.svg`),
    'utf8',
  )
  return new DOMParser().parseFromString(markup, 'image/svg+xml')
}

function parsePolylinePoints(element: Element): SvgPoint[] {
  const coordinates = (element.getAttribute('points')?.match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map(Number)

  return Array.from({ length: coordinates.length / 2 }, (_, index) => ({
    x: coordinates[index * 2],
    y: coordinates[index * 2 + 1],
  }))
}

function parsePathEndpoints(element: Element) {
  const coordinates = (element.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map(Number)

  return {
    start: { x: coordinates[0], y: coordinates[1] },
    end: {
      x: coordinates[coordinates.length - 2],
      y: coordinates[coordinates.length - 1],
    },
  }
}

describe('standard exercise catalog', () => {
  it('ships exactly the 50 required exercises with stable unique IDs and names', () => {
    const ids = STANDARD_EXERCISES.map(({ id }) => id)
    const names = STANDARD_EXERCISES.map(({ name }) => name)

    expect(STANDARD_EXERCISES).toHaveLength(50)
    expect(new Set(ids)).toHaveLength(50)
    expect([...ids].sort()).toEqual([...REQUIRED_EXERCISE_IDS].sort())
    expect(new Set(names)).toHaveLength(50)
    expect(names.every((name) => name.trim().length > 0)).toBe(true)
  })

  it('provides complete standard metadata and one valid illustration path per exercise', () => {
    const illustrationPaths = STANDARD_EXERCISES.map(
      ({ illustrationPath }) => illustrationPath,
    )

    for (const exercise of STANDARD_EXERCISES) {
      expect(exercise.source).toBe('standard')
      expect(exercise.primaryMuscles.length).toBeGreaterThan(0)
      expect(exercise.equipment.length).toBeGreaterThan(0)
      expect(exercise.description.trim().length).toBeGreaterThan(0)
      expect(exercise.illustrationPath).toBe(
        `training/exercises/${exercise.id}.svg`,
      )
    }

    expect(new Set(illustrationPaths)).toHaveLength(50)
  })

  it('offers the required grip choices only on the specified pulling exercises', () => {
    const pulldownGrips = ['Breit', 'Eng', 'Neutral', 'Untergriff']

    expect(getExerciseDefinition('lat-pulldown')?.gripOptions).toEqual(
      pulldownGrips,
    )
    expect(
      getExerciseDefinition('close-grip-lat-pulldown')?.gripOptions,
    ).toEqual(pulldownGrips)
    expect(getExerciseDefinition('seated-cable-row')?.gripOptions).toEqual([
      'Enger Parallelgriff',
      'Breit',
      'Neutral',
      'Einarmig',
    ])

    const exercisesWithGripOptions = STANDARD_EXERCISES.filter(
      ({ gripOptions }) => gripOptions.length > 0,
    ).map(({ id }) => id)
    expect(exercisesWithGripOptions).toEqual([
      'lat-pulldown',
      'close-grip-lat-pulldown',
      'seated-cable-row',
    ])
  })

  it('enables bodyweight modes only for pull-ups and dips', () => {
    const bodyweightExerciseIds = STANDARD_EXERCISES.filter(
      ({ supportsBodyweightModes }) => supportsBodyweightModes,
    ).map(({ id }) => id)

    expect(bodyweightExerciseIds).toEqual(['pull-up', 'dip'])
  })

  it('resolves catalog entries by ID and returns undefined for unknown IDs', () => {
    const benchPress = STANDARD_EXERCISES[0]

    expect(exerciseById.get('bench-press')).toBe(benchPress)
    expect(getExerciseDefinition('bench-press')).toBe(benchPress)
    expect(getExerciseDefinition('not-in-the-catalog')).toBeUndefined()
  })
})

describe('standard exercise illustrations', () => {
  it('ships one unique, structurally compliant SVG for every catalog entry', () => {
    const assetNames = readdirSync(exerciseAssetDirectory)
      .filter((name) => name.endsWith('.svg'))
      .sort()
    const expectedAssetNames = REQUIRED_EXERCISE_IDS.map((id) => `${id}.svg`).sort()
    const svgContents = assetNames.map((name) =>
      readFileSync(resolve(exerciseAssetDirectory, name), 'utf8'),
    )

    expect(assetNames).toEqual(expectedAssetNames)
    const geometryContents = svgContents.map((markup) =>
      markup.replace(/ data-exercise-id="[^"]+"/, ''),
    )

    expect(new Set(geometryContents)).toHaveLength(50)

    for (const [index, markup] of svgContents.entries()) {
      const document = new DOMParser().parseFromString(markup, 'image/svg+xml')
      const svg = document.documentElement
      const exerciseId = assetNames[index].replace(/\.svg$/, '')

      expect(document.querySelector('parsererror')).toBeNull()
      expect(svg.tagName).toBe('svg')
      expect(svg.getAttribute('viewBox')).toBe('0 0 640 360')
      expect(svg.getAttribute('data-exercise-id')).toBe(exerciseId)
      expect(svg.querySelector('[data-equipment]')).not.toBeNull()
      expect(svg.querySelector('[data-pose="start"]')).not.toBeNull()
      expect(svg.querySelector('[data-pose="end"]')).not.toBeNull()
      expect(svg.querySelector('[data-pose="end"]')?.getAttribute('opacity')).toBe(
        '0.38',
      )
      expect(svg.querySelector('[data-motion="arrow"]')).not.toBeNull()
      expect(svg.querySelector('[data-muscle-map="front"]')).not.toBeNull()
      expect(svg.querySelector('[data-muscle-map="back"]')).not.toBeNull()
      expect(svg.querySelector('[data-muscle="primary"]')?.getAttribute('fill')).toBe(
        '#f59e0b',
      )
      expect(
        svg.querySelector('[data-muscle="secondary"]')?.getAttribute('fill'),
      ).toBe('#f59e0b')
      expect(
        svg.querySelector('[data-muscle="secondary"]')?.getAttribute('opacity'),
      ).toBe('0.38')
      expect(svg.querySelector('text')).toBeNull()
      expect(svg.querySelector('image')).toBeNull()
      expect(svg.querySelector('[href^="http"]')).toBeNull()
    }
  })

  it('shows both dumbbells moving forward and upward during the front raise', () => {
    const document = readExerciseSvg('front-raise')
    const startArms = ['near-arm', 'far-arm'].map((limb) =>
      document.querySelector(
        `[data-pose="start"] polyline[data-limb="${limb}"]`,
      ),
    )
    const endArms = ['near-arm', 'far-arm'].map((limb) =>
      document.querySelector(
        `[data-pose="end"] polyline[data-limb="${limb}"]`,
      ),
    )
    const motionArrow = document.querySelector('[data-motion="arrow"]')

    expect(startArms.every(Boolean)).toBe(true)
    expect(endArms.every(Boolean)).toBe(true)
    expect(motionArrow).not.toBeNull()
    if (startArms.some((arm) => !arm) || endArms.some((arm) => !arm) || !motionArrow) {
      return
    }

    const startPoints = startArms.map((arm) => parsePolylinePoints(arm!))
    const endPoints = endArms.map((arm) => parsePolylinePoints(arm!))

    for (const [index, points] of startPoints.entries()) {
      const startShoulder = points[0]
      const startHand = points.at(-1)!
      const endShoulder = endPoints[index][0]
      const endHand = endPoints[index].at(-1)!

      expect(points).toHaveLength(3)
      expect(endPoints[index]).toHaveLength(3)
      expect(endShoulder).toEqual(startShoulder)
      expect(endHand.x - startHand.x).toBeGreaterThan(90)
      expect(startHand.y - endHand.y).toBeGreaterThan(80)
    }

    const nearStartHand = startPoints[0].at(-1)!
    const nearEndHand = endPoints[0].at(-1)!
    const farEndHand = endPoints[1].at(-1)!
    const arrow = parsePathEndpoints(motionArrow)

    expect(Math.abs(nearEndHand.x - farEndHand.x)).toBeLessThan(15)
    expect(Math.abs(nearEndHand.y - farEndHand.y)).toBeLessThan(15)
    expect(arrow).toEqual({ start: nearStartHand, end: nearEndHand })
  })

  it('shows both hanging legs moving together forward and upward', () => {
    const document = readExerciseSvg('hanging-leg-raise')
    const startLegs = ['near-leg', 'far-leg'].map((limb) =>
      document.querySelector(
        `[data-pose="start"] polyline[data-limb="${limb}"]`,
      ),
    )
    const endLegs = ['near-leg', 'far-leg'].map((limb) =>
      document.querySelector(
        `[data-pose="end"] polyline[data-limb="${limb}"]`,
      ),
    )
    const motionArrow = document.querySelector('[data-motion="arrow"]')

    expect(startLegs.every(Boolean)).toBe(true)
    expect(endLegs.every(Boolean)).toBe(true)
    expect(motionArrow).not.toBeNull()
    if (startLegs.some((leg) => !leg) || endLegs.some((leg) => !leg) || !motionArrow) {
      return
    }

    const startPoints = startLegs.map((leg) => parsePolylinePoints(leg!))
    const endPoints = endLegs.map((leg) => parsePolylinePoints(leg!))

    for (const [index, points] of startPoints.entries()) {
      const startHip = points[0]
      const startFoot = points.at(-1)!
      const endHip = endPoints[index][0]
      const endFoot = endPoints[index].at(-1)!

      expect(points).toHaveLength(3)
      expect(endPoints[index]).toHaveLength(3)
      expect(endHip).toEqual(startHip)
      expect(endFoot.x - startFoot.x).toBeGreaterThan(130)
      expect(startFoot.y - endFoot.y).toBeGreaterThan(65)
    }

    const nearStartFoot = startPoints[0].at(-1)!
    const nearEndFoot = endPoints[0].at(-1)!
    const farEndFoot = endPoints[1].at(-1)!
    const arrow = parsePathEndpoints(motionArrow)

    expect(Math.abs(nearEndFoot.x - farEndFoot.x)).toBeLessThan(15)
    expect(Math.abs(nearEndFoot.y - farEndFoot.y)).toBeLessThan(15)
    expect(arrow).toEqual({ start: nearStartFoot, end: nearEndFoot })
  })
})

describe('ExerciseIllustration', () => {
  it('renders a lazy-loaded technical illustration with an informative alt label', () => {
    const exercise = STANDARD_EXERCISES[0]
    const { container } = render(createElement(ExerciseIllustration, { exercise }))
    const image = container.querySelector('img')

    expect(image).toHaveAttribute(
      'alt',
      `Technische Darstellung: ${exercise.name}`,
    )
    expect(image).toHaveAttribute(
      'src',
      `${import.meta.env.BASE_URL}${exercise.illustrationPath}`,
    )
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).not.toHaveAttribute('aria-hidden')
  })

  it('removes the alt label and hides decorative illustrations', () => {
    const exercise = STANDARD_EXERCISES[0]
    const { container } = render(
      createElement(ExerciseIllustration, { exercise, decorative: true }),
    )
    const image = container.querySelector('img')

    expect(image).toHaveAttribute('alt', '')
    expect(image).toHaveAttribute('aria-hidden', 'true')
  })
})
