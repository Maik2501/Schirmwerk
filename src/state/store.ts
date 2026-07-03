/**
 * Zentraler App-State (Zustand).
 * Das Panel schreibt Parameter, Viewport und Checks abonnieren sie.
 * Geometrie wird hier NICHT berechnet – das bleibt im Geometrie-Modul.
 */
import { create } from 'zustand'
import type { NeckParams, ProfileParams, Resolution, ShadeParams, WaveParams } from '../geometry/types'
import { defaultShadeParams, EXPORT_RESOLUTION, PREVIEW_RESOLUTION } from '../geometry/defaults'

interface StudioState {
  params: ShadeParams
  previewRes: Resolution
  exportRes: Resolution
  /** Glühbirnen-Simulation an/aus */
  bulbOn: boolean
  /** Dimmer der Glühbirne, 0.1–1 */
  bulbBrightness: number

  setParams: (patch: Partial<ShadeParams>) => void
  setProfile: (patch: Partial<ProfileParams>) => void
  setWaves: (patch: Partial<WaveParams>) => void
  setNeck: (patch: Partial<NeckParams>) => void
  setPreviewRes: (patch: Partial<Resolution>) => void
  setExportRes: (patch: Partial<Resolution>) => void
  toggleBulb: () => void
  setBulbBrightness: (value: number) => void
}

export const useStudio = create<StudioState>()((set) => ({
  params: defaultShadeParams(),
  previewRes: PREVIEW_RESOLUTION,
  exportRes: EXPORT_RESOLUTION,
  bulbOn: true,
  bulbBrightness: 1,

  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  setProfile: (patch) =>
    set((s) => ({ params: { ...s.params, profile: { ...s.params.profile, ...patch } } })),
  setWaves: (patch) =>
    set((s) => ({ params: { ...s.params, waves: { ...s.params.waves, ...patch } } })),
  setNeck: (patch) =>
    set((s) => ({ params: { ...s.params, neck: { ...s.params.neck, ...patch } } })),
  setPreviewRes: (patch) => set((s) => ({ previewRes: { ...s.previewRes, ...patch } })),
  setExportRes: (patch) => set((s) => ({ exportRes: { ...s.exportRes, ...patch } })),
  toggleBulb: () => set((s) => ({ bulbOn: !s.bulbOn })),
  setBulbBrightness: (value) => set({ bulbBrightness: Math.min(1, Math.max(0.1, value)) }),
}))
