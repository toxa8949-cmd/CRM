export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { money } from '@/lib/money'

function startOfMonth(){ const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d }
function startOfToday(){ const d = new Date(); d.setHours(0,0,0,0); return d }

export default async function ReportsPage(){
  const today = startOfToday(), month = startOfMonth()
  const [salesToday,salesMonth,expensesToday,expensesMonth,stock] = await Promise.all([
    prisma.sale.findMany({where:{date:{gte:today}}}),
    prisma.sale.findMany({where:{date:{gte:month}}}),
    prisma.expense.findMany({where:{date:{gte:today}}}),
    prisma.expense.findMany({where:{date:{gte:month}}}),
    prisma.product.findMany({orderBy:{name:'asc'}})
  ])
  const sum = (arr:any[], key:string) => arr.reduce((s,x)=>s+Number(x[key]),0)
  const stockValuePurchase = stock.reduce((s,p)=>s+Number(p.purchasePrice)*p.quantity,0)
  const stockValueSale = stock.reduce((s,p)=>s+Number(p.salePrice)*p.quantity,0)
  const dayRevenue=sum(salesToday,'totalAmount'), dayTax=sum(salesToday,'taxAmount'), dayGross=sum(salesToday,'profitAmount'), dayExpenses=sum(expensesToday,'amount')
  const monthRevenue=sum(salesMonth,'totalAmount'), monthTax=sum(salesMonth,'taxAmount'), monthGross=sum(salesMonth,'profitAmount'), monthExpenses=sum(expensesMonth,'amount')
  return <><h1>Звіти</h1><div className="grid"><div className="card"><h3>Дохід сьогодні</h3><div className="big">{money(dayRevenue)}</div><p>Податок: {money(dayTax)}</p><p>Витрати: {money(dayExpenses)}</p><p><b>Чисто: {money(dayGross-dayExpenses)}</b></p></div><div className="card"><h3>Дохід місяць</h3><div className="big">{money(monthRevenue)}</div><p>Податок: {money(monthTax)}</p><p>Витрати: {money(monthExpenses)}</p><p><b>Чисто: {money(monthGross-monthExpenses)}</b></p></div><div className="card"><h3>Склад по закупці</h3><div className="big">{money(stockValuePurchase)}</div></div><div className="card"><h3>Склад по продажу</h3><div className="big">{money(stockValueSale)}</div></div></div><h2>Залишок товару</h2><table className="table"><thead><tr><th>Товар</th><th>Кількість</th><th>Закупка/шт</th><th>Продаж/шт</th><th>Вартість складу</th></tr></thead><tbody>{stock.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.quantity}</td><td>{money(p.purchasePrice)}</td><td>{money(p.salePrice)}</td><td>{money(Number(p.purchasePrice)*p.quantity)}</td></tr>)}</tbody></table></>
}
