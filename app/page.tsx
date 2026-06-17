import { prisma } from '@/lib/prisma'
import { money } from '@/lib/money'

export default async function Dashboard(){
  const today = new Date(); today.setHours(0,0,0,0)
  const [sales, expenses, products] = await Promise.all([
    prisma.sale.findMany({ where:{date:{gte:today}} }),
    prisma.expense.findMany({ where:{date:{gte:today}} }),
    prisma.product.findMany({ orderBy:{quantity:'asc'}, take:8 })
  ])
  const revenue = sales.reduce((s,x)=>s+Number(x.totalAmount),0)
  const profit = sales.reduce((s,x)=>s+Number(x.profitAmount),0) - expenses.reduce((s,x)=>s+Number(x.amount),0)
  const tax = sales.reduce((s,x)=>s+Number(x.taxAmount),0)
  return <><h1>Панель магазину</h1><div className="grid"><div className="card"><h3>Продажі сьогодні</h3><div className="big">{money(revenue)}</div></div><div className="card"><h3>Прибуток сьогодні</h3><div className="big">{money(profit)}</div></div><div className="card"><h3>Податок ryczałt</h3><div className="big">{money(tax)}</div></div><div className="card"><h3>Кількість продажів</h3><div className="big">{sales.length}</div></div></div><h2>Товари з малим залишком</h2><table className="table"><thead><tr><th>Товар</th><th>SKU</th><th>Залишок</th><th>Ціна</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td className={p.quantity<=1?'danger':''}>{p.quantity}</td><td>{money(p.salePrice)}</td></tr>)}</tbody></table></>
}
