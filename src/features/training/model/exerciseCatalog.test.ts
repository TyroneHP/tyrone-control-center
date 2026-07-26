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
    expect(new Set(svgContents)).toHaveLength(50)

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
