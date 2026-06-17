import './style.css'
import Link from 'next/link'

export const metadata = { title: 'Rower CRM', description: 'CRM/POS для магазину' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="uk"><body><nav className="nav"><Link href="/">Панель</Link><Link href="/products">Товари</Link><Link href="/sales">Продажі</Link><Link href="/expenses">Витрати</Link><Link href="/reports">Звіти</Link></nav><main className="container">{children}</main></body></html>
}
