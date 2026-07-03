import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Schriften werden lokal gebündelt (offline-fähig, kein CDN):
// Space Grotesk = Sprache/Labels, IBM Plex Mono = Zahlen/Werte
import '@fontsource-variable/space-grotesk/index.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
