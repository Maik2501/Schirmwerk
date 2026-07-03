# Schirmwerk – Lampenschirm-Generator

Parametrischer Lampenschirm-Generator für den 3D-Druck im Spiral-/Vase-Mode.
Läuft komplett im Browser (kein Backend): Live-3D-Vorschau mit PETG-Material-
Simulation und schaltbarem Glühbirnen-Licht, Export als wasserdichte Binär-STL.

**Status: in Entwicklung.** Fertig: Feature 1 (Scaffold, Geometrie-Kern mit
Tests, 3D-Vorschau). Es folgen: Parameter-Panel, STL-Export,
Druckbarkeits-Checks, Presets/Teilen-Links.

## Entwicklung

```bash
npm install
npm run dev    # Dev-Server auf http://localhost:5173
npm test       # Geometrie-Tests (Vitest)
npm run build  # Typecheck + Produktions-Build
```

## Architektur in einem Satz

`src/geometry/` rechnet (pur, getestet, framework-frei), `src/state/` hält die
Parameter (Zustand), `src/viewport/` und `src/panel/` rendern nur.

## Druck-Hinweise (Kurzfassung, ausführlich nach MVP-Abschluss)

- Spiral-/Vase-Mode aktivieren, **0 Bodenschichten** → Unterseite bleibt offen
- Transparentes PETG, etwas breitere Extrusion (≈ 0.5–0.6 mm bei 0.4er Düse)
- Der Hals ist auf E27-/E14-Schirmringe ausgelegt (40 mm / 28.5 mm Loch
  plus Toleranz, einstellbar)
