# Schirmwerk – Arbeitsvereinbarung

Parametrischer Lampenschirm-Generator (Vase-Mode-3D-Druck), Browser-only.
Stack: Vite + React + TS, three.js via @react-three/fiber/drei, Zustand,
Tailwind v4 (Tokens in `src/index.css` unter `@theme`), Vitest.

## Arbeitsweise

- **Iterativ mit Checkpoints:** Vor jedem MVP-Feature Zwischenstand zeigen
  und auf OK warten. Rückfragen statt Annahmen. Kommunikation und UI Deutsch,
  Code-Bezeichner Englisch, Mathe-Kommentare Deutsch.
- **Geometrie nur in `src/geometry/`:** reine Funktionen, framework-frei,
  mit Vitest getestet (Manifold, Orientierung, r > 0, Volumen). Vorschau und
  Export nutzen dieselben Builder, nur andere Auflösung/caps.
- Ein Git-Commit pro Feature.

## Befehle

- `npm run dev` (Port 5173, strictPort), `npm test`, `npm run build`

## Backlog (nach MVP, gemeinsam priorisieren)

- **Nachttischlampen-Variante** (Nutzerwunsch 03.07.2026): stehender Schirm
  bzw. Fassung unten – Druck- und Nutzungsorientierung entkoppeln,
  Hals-Position als Parameter (oben/unten)
- Layerlinien-Optik als prozedurale Normal-Map in der Vorschau
- MeshTransmissionMaterial als schaltbare „Schön“-Vorschau
- Weitere Wellenformen (Dreieck, Sägezahn, Superformula), 3MF-Export,
  Druckzeit-/Materialschätzung, Galerie-/Turntable-Ansicht
- Spline-Editor: Punkte per Tastatur verschiebbar machen (A11y),
  Kurven-Presets speichern/laden

## Domänen-Konventionen

- Längen in mm, z = Höhenachse (0 = Druckbett), STL Z-oben
- Wellenzahlen n1/n2 ganzzahlig (sonst Naht bei θ=0)
- Twist = Muster-Rotation in Grad über die Gesamthöhe
- Zielmaschine: Bambu Lab P1S (256³ mm), aber Größen nicht hart begrenzen
