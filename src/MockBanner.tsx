import { useState } from 'react'
import './MockBanner.css'

export default function MockBanner() {
  const [busy, setBusy] = useState(false)
  async function reset() { setBusy(true); const { resetMock } = await import('./api/mock'); resetMock(); window.location.reload() }
  return <div className="mock-banner" role="region" aria-label="Aviso de datos de ejemplo"><p>Datos de ejemplo: nada de lo que ves es real</p><button type="button" disabled={busy} onClick={() => void reset()}>{busy ? 'Reiniciando…' : 'Reiniciar datos'}</button></div>
}
