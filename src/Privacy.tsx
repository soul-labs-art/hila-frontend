import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Schemas } from './api/client'
import { Feedback, PageHeading, StatusBadge } from './components'
import { BackLink, Card, Notice, Toggle } from './ui'
import { usePageTitle } from './page-title'
import { loadVolunteer } from './volunteer'

const date = (value: string) => new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

export function Privacy() {
  usePageTitle('Privacidad y avisos')
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const consents = useQuery({ queryKey: ['consents'], queryFn: () => api<Schemas['Consent'][]>('/me/consents'), retry: false })
  const policies = useQuery({ queryKey: ['policies'], queryFn: () => api<Schemas['Policy'][]>('/policies/current'), retry: false })
  const volunteer = useQuery({ queryKey: ['volunteer'], queryFn: loadVolunteer, retry: false })
  if (consents.isPending || policies.isPending || volunteer.isPending) return <p role="status">Consultando tu privacidad…</p>
  const failure = consents.error || policies.error || volunteer.error
  if (failure) return <><Feedback error={failure} /><button className="action" onClick={() => { void consents.refetch(); void policies.refetch(); void volunteer.refetch() }}>Volver a intentar</button></>
  const data = consents.data.find(item => item.type === 'DATA_PROCESSING' && !item.revokedAt)
  const dataPolicy = policies.data.find(item => item.type === 'DATA_PROCESSING'), alertPolicy = policies.data.find(item => item.type === 'OPPORTUNITY_ALERTS')
  const enabled = !!volunteer.data?.emailOpportunityAlerts
  async function setAlerts(value: boolean) {
    if (!alertPolicy) return
    setBusy(true); setError(undefined); setNotice('')
    try {
      await api('/me/opportunity-alerts', { method: 'PUT', body: { enabled: value, policyVersion: alertPolicy.version } })
      await Promise.all([client.invalidateQueries({ queryKey: ['volunteer'] }), client.invalidateQueries({ queryKey: ['consents'] })])
      setNotice(value ? 'Activamos los avisos por correo.' : 'Desactivamos los avisos por correo.')
    } catch (value) { setError(value) } finally { setBusy(false) }
  }
  return <>
    <BackLink to="/mi-cuenta">Mi cuenta</BackLink>
    <PageHeading title="Privacidad y avisos" lead="Aquí ves lo que aceptaste y decides qué correos quieres recibir." />
    <div className="settings-stack"><Card as="section" className="settings-section" aria-labelledby="data-title"><h2 id="data-title">Tratamiento de datos</h2>
      {data ? <><div className="setting-state"><StatusBadge tone="ok">Política aceptada</StatusBadge><span>Versión {data.version}, el {date(data.acceptedAt)}.</span></div></> : <p>No encontramos una aceptación registrada de la política de datos.</p>}
      {dataPolicy && <details className="policy"><summary>{dataPolicy.title} · versión {dataPolicy.version}</summary><div>{dataPolicy.content}</div></details>}
    </Card>
    <Card as="section" className="settings-section" aria-labelledby="alerts-title"><h2 id="alerts-title">Avisos de oportunidades por correo</h2>
      <p>Te escribiremos cuando haya oportunidades que encajen con tu perfil. Esto no afecta los correos de tu cuenta, como la verificación o la recuperación de acceso.</p>
      <Feedback error={error} success={notice} />
      {volunteer.data ? <><Toggle icon="mail" label="Recibir avisos por correo" hint="Oportunidades que encajen con tu perfil." checked={enabled} disabled={busy || !alertPolicy} onChange={value => void setAlerts(value)} onText="Avisos activados" offText="Avisos desactivados" />
        {alertPolicy && <details className="policy"><summary>{alertPolicy.title} · versión {alertPolicy.version}</summary><div>{alertPolicy.content}</div></details>}
        </>
        : <Notice icon="person">Para recibir avisos necesitas tu perfil voluntario, así sabremos qué oportunidades te corresponden. <Link to="/mi-perfil">Crear mi perfil</Link></Notice>}
    </Card></div>
  </>
}
