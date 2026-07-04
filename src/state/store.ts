/**
 * Zentraler App-State (Zustand).
 * Das Panel schreibt Parameter, Viewport und Checks abonnieren sie.
 * Geometrie wird hier NICHT berechnet – das bleibt im Geometrie-Modul.
 */
import { create } from 'zustand'
import type { NeckParams, ProfileMode, ProfileParams, Resolution, ShadeParams, WaveParams } from '../geometry/types'
import { defaultShadeParams, EXPORT_RESOLUTION, PREVIEW_RESOLUTION } from '../geometry/defaults'
import { seedBezierFromProfile, seedSplineFromProfile } from '../geometry/profile'
import { PETG_TRANSLUCENT, type FilamentColor } from './filaments'
import type { ShareDesign } from './designs'

/** Nutzungs-Aufbau: hängende Pendelleuchte oder stehende Nachttischlampe */
export type Mounting = 'haengend' | 'stehend'

interface StudioState {
  params: ShadeParams
  previewRes: Resolution
  exportRes: Resolution
  /** Aufbau der Vorschau-Szene; 'stehend' zeigt Fuß statt Kabel */
  mounting: Mounting
  /** Glühbirnen-Simulation an/aus */
  bulbOn: boolean
  /** Dimmer der Glühbirne, 0.1–1 */
  bulbBrightness: number
  /** Filament-Farbe der Vorschau (Bambu PETG Translucent), rein visuell */
  shadeColor: FilamentColor
  /** Layerlinien-Optik (prozedurale Normal-Map) in der Vorschau */
  layerLines: boolean
  /** „Glas-Vorschau“: MeshTransmissionMaterial mit echter Brechung (GPU-lastig) */
  glassPreview: boolean
  /** Drehteller: Kamera rotiert automatisch ums Modell */
  turntable: boolean

  setParams: (patch: Partial<ShadeParams>) => void
  setProfile: (patch: Partial<ProfileParams>) => void
  setProfileMode: (mode: ProfileMode) => void
  setWaves: (patch: Partial<WaveParams>) => void
  setNeck: (patch: Partial<NeckParams>) => void
  setPreviewRes: (patch: Partial<Resolution>) => void
  setExportRes: (patch: Partial<Resolution>) => void
  toggleBulb: () => void
  setBulbBrightness: (value: number) => void
  setShadeColor: (color: FilamentColor) => void
  setMounting: (mounting: Mounting) => void
  toggleLayerLines: () => void
  toggleGlassPreview: () => void
  toggleTurntable: () => void
  /** Komplettes Design anwenden (Bibliothek/Share-URL) */
  applyDesign: (design: ShareDesign) => void
}

export const useStudio = create<StudioState>()((set) => ({
  params: defaultShadeParams(),
  previewRes: PREVIEW_RESOLUTION,
  exportRes: EXPORT_RESOLUTION,
  bulbOn: true,
  bulbBrightness: 1,
  shadeColor: PETG_TRANSLUCENT[0],
  mounting: 'haengend',
  layerLines: true,
  glassPreview: false,
  turntable: false,

  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  setProfile: (patch) =>
    set((s) => ({ params: { ...s.params, profile: { ...s.params.profile, ...patch } } })),
  setProfileMode: (mode) =>
    set((s) => {
      const prev = s.params.profile
      if (mode === prev.mode) return s
      // Beim Einstieg in einen freien Modus die aktuell sichtbare Kurve
      // übernehmen – die Form springt beim Umschalten nie.
      const profile: ProfileParams = { ...prev, mode }
      if (mode === 'bezier') profile.bezier = seedBezierFromProfile(prev)
      if (mode === 'spline') profile.spline = seedSplineFromProfile(prev)
      return { params: { ...s.params, profile } }
    }),
  setWaves: (patch) =>
    set((s) => ({ params: { ...s.params, waves: { ...s.params.waves, ...patch } } })),
  setNeck: (patch) =>
    set((s) => ({ params: { ...s.params, neck: { ...s.params.neck, ...patch } } })),
  setPreviewRes: (patch) => set((s) => ({ previewRes: { ...s.previewRes, ...patch } })),
  setExportRes: (patch) => set((s) => ({ exportRes: { ...s.exportRes, ...patch } })),
  toggleBulb: () => set((s) => ({ bulbOn: !s.bulbOn })),
  setBulbBrightness: (value) => set({ bulbBrightness: Math.min(1, Math.max(0.1, value)) }),
  setShadeColor: (color) => set({ shadeColor: color }),
  setMounting: (mounting) =>
    set((s) => ({
      mounting,
      // Hängend gibt es nur mit Kragen oben (die Lampe hängt an der Fassung)
      params:
        mounting === 'haengend' ? { ...s.params, neckPosition: 'top' } : s.params,
    })),
  toggleLayerLines: () => set((s) => ({ layerLines: !s.layerLines })),
  toggleGlassPreview: () => set((s) => ({ glassPreview: !s.glassPreview })),
  toggleTurntable: () => set((s) => ({ turntable: !s.turntable })),
  applyDesign: (design) =>
    set(() => ({
      params: design.params,
      shadeColor:
        PETG_TRANSLUCENT.find((f) => f.id === design.shadeColorId) ?? PETG_TRANSLUCENT[0],
      mounting: design.mounting,
    })),
}))
