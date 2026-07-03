/**
 * Zentraler App-State (Zustand).
 * Das Panel schreibt Parameter, Viewport und Checks abonnieren sie.
 * Geometrie wird hier NICHT berechnet – das bleibt im Geometrie-Modul.
 */
import { create } from 'zustand'
import type { Resolution, ShadeParams } from '../geometry/types'
import { defaultShadeParams, EXPORT_RESOLUTION, PREVIEW_RESOLUTION } from '../geometry/defaults'

interface StudioState {
  params: ShadeParams
  previewRes: Resolution
  exportRes: Resolution
  /** Glühbirnen-Simulation an/aus */
  bulbOn: boolean

  setParams: (patch: Partial<ShadeParams>) => void
  toggleBulb: () => void
}

export const useStudio = create<StudioState>()((set) => ({
  params: defaultShadeParams(),
  previewRes: PREVIEW_RESOLUTION,
  exportRes: EXPORT_RESOLUTION,
  bulbOn: true,

  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  toggleBulb: () => set((s) => ({ bulbOn: !s.bulbOn })),
}))
