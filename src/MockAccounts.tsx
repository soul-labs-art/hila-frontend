import { demoAccounts } from './api/mock/demo-accounts'
import { examplePassword } from './api/mock/seed'
import './MockBanner.css'

export default function MockAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  return <section className="mock-accounts" aria-labelledby="mock-accounts-title"><h2 id="mock-accounts-title">Cuentas de ejemplo</h2><p>Todas usan la contraseña <code>{examplePassword}</code>. Son ficticias y solo existen en este modo.</p><ul>{demoAccounts.map(account => <li key={account.email}><div><strong>{account.name}</strong><span>{account.email}</span><span>{account.note}</span></div><button type="button" className="text-button" aria-label={`Usar esta cuenta: ${account.name}`} onClick={() => onPick(account.email, examplePassword)}>Usar esta cuenta</button></li>)}</ul></section>
}
