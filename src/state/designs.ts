/**
 * Design-Bibliothek: komplette Designs (Geometrie + Material + Aufbau)
 * in localStorage sichern, als Datei exportieren/importieren und über
 * eine Hash-URL teilen (#d=<base64url(JSON)>).
 *
 * Alles hier ist pur und testbar: Storage wird injiziert (Node-Tests
 * haben kein localStorage), und alles Geladene läuft durch sanitize –
 * fremde/alte Daten dürfen die App nie in einen invaliden Zustand
 * bringen. Unbekannte Werte fallen feldweise auf die Defaults zurück.
 */
import { defaultShadeParams } from '../geometry/defaults'
import type {
  NeckPosition,
  ProfileMode,
  ProfilePreset,
  ShadeParams,
  SplinePoint,
  Waveform,
} from '../geometry/types'
import type { Mounting } from './store'

export interface SavedDesign {
  id: string
  name: string
  savedAt: string
  params: ShadeParams
  shadeColorId: string
  mounting: Mounting
}

/** Teilmenge, die zum Anwenden/Teilen eines Designs reicht. */
export type ShareDesign = Pick<SavedDesign, 'name' | 'params' | 'shadeColorId' | 'mounting'>

const STORAGE_KEY = 'schirmwerk.designs.v1'

// ---- Validierung -----------------------------------------------------------

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

/** Fremde Parameter feldweise gegen die Defaults absichern. */
export function sanitizeParams(raw: unknown): ShadeParams | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<ShadeParams>
  const d = defaultShadeParams()

  const profile: Partial<ShadeParams['profile']> =
    typeof r.profile === 'object' && r.profile !== null ? r.profile : {}
  const waves: Partial<ShadeParams['waves']> =
    typeof r.waves === 'object' && r.waves !== null ? r.waves : {}
  const neck: Partial<ShadeParams['neck']> =
    typeof r.neck === 'object' && r.neck !== null ? r.neck : {}
  const bezier: Partial<ShadeParams['profile']['bezier']> =
    typeof profile.bezier === 'object' && profile.bezier !== null ? profile.bezier : {}
  const spline: SplinePoint[] = Array.isArray(profile.spline)
    ? (profile.spline as unknown[])
        .filter((p): p is SplinePoint => {
          if (typeof p !== 'object' || p === null) return false
          const q = p as Partial<SplinePoint>
          return Number.isFinite(q.rMm) && Number.isFinite(q.t)
        })
        .map((p) => ({ rMm: p.rMm, t: p.t }))
    : d.profile.spline

  return {
    heightMm: num(r.heightMm, d.heightMm),
    neckPosition: oneOf<NeckPosition>(r.neckPosition, ['top', 'bottom'], d.neckPosition),
    footBlendMm: num(r.footBlendMm, d.footBlendMm),
    profile: {
      mode: oneOf<ProfileMode>(profile.mode, ['preset', 'bezier', 'spline'], d.profile.mode),
      preset: oneOf<ProfilePreset>(
        profile.preset,
        ['zylinder', 'konus', 'tropfen', 'glocke', 'saeule'],
        d.profile.preset,
      ),
      bottomRadiusMm: num(profile.bottomRadiusMm, d.profile.bottomRadiusMm),
      topRadiusMm: num(profile.topRadiusMm, d.profile.topRadiusMm),
      shapeAmount: num(profile.shapeAmount, d.profile.shapeAmount),
      bezier: {
        r1Mm: num(bezier.r1Mm, d.profile.bezier.r1Mm),
        t1: num(bezier.t1, d.profile.bezier.t1),
        r2Mm: num(bezier.r2Mm, d.profile.bezier.r2Mm),
        t2: num(bezier.t2, d.profile.bezier.t2),
      },
      spline,
    },
    waves: {
      waveform: oneOf<Waveform>(
        waves.waveform,
        ['sinus', 'dreieck', 'saegezahn', 'superformula'],
        d.waves.waveform,
      ),
      n1: num(waves.n1, d.waves.n1),
      a1: num(waves.a1, d.waves.a1),
      n2: num(waves.n2, d.waves.n2),
      a2: num(waves.a2, d.waves.a2),
      twistDeg: num(waves.twistDeg, d.waves.twistDeg),
      phase1Rad: num(waves.phase1Rad, d.waves.phase1Rad),
      phase2Rad: num(waves.phase2Rad, d.waves.phase2Rad),
    },
    neck: {
      socket: oneOf(neck.socket, ['e14', 'e27', 'custom'], d.neck.socket),
      holeDiameterMm: num(neck.holeDiameterMm, d.neck.holeDiameterMm),
      extraClearanceMm: num(neck.extraClearanceMm, d.neck.extraClearanceMm),
      heightMm: num(neck.heightMm, d.neck.heightMm),
      blendMm: num(neck.blendMm, d.neck.blendMm),
    },
  }
}

function sanitizeDesign(raw: unknown): SavedDesign | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<SavedDesign>
  const params = sanitizeParams(r.params)
  if (!params) return null
  return {
    id: typeof r.id === 'string' && r.id ? r.id : cryptoRandomId(),
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : 'Design',
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : '',
    params,
    shadeColorId: typeof r.shadeColorId === 'string' ? r.shadeColorId : 'clear',
    mounting: oneOf<Mounting>(r.mounting, ['haengend', 'stehend'], 'haengend'),
  }
}

export function cryptoRandomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

// ---- localStorage ----------------------------------------------------------

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const defaultStorage = (): StorageLike | null =>
  typeof localStorage === 'undefined' ? null : localStorage

export function loadDesigns(storage: StorageLike | null = defaultStorage()): SavedDesign[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeDesign).filter((d): d is SavedDesign => d !== null)
  } catch {
    return []
  }
}

export function persistDesigns(
  designs: SavedDesign[],
  storage: StorageLike | null = defaultStorage(),
): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(designs))
}

/** JSON-Import einer Bibliotheksdatei (Array von Designs). */
export function parseLibraryJson(text: string): SavedDesign[] {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeDesign).filter((d): d is SavedDesign => d !== null)
  } catch {
    return []
  }
}

// ---- Share-URL (#d=<base64url>) --------------------------------------------

export function encodeShare(design: ShareDesign): string {
  const bytes = new TextEncoder().encode(JSON.stringify(design))
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function decodeShare(encoded: string): ShareDesign | null {
  try {
    const b64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const raw: unknown = JSON.parse(new TextDecoder().decode(bytes))
    const design = sanitizeDesign({ ...(raw as object), id: 'shared', savedAt: '' })
    return design
      ? { name: design.name, params: design.params, shadeColorId: design.shadeColorId, mounting: design.mounting }
      : null
  } catch {
    return null
  }
}
