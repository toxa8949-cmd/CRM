import { prisma } from '@/lib/prisma'
import { money } from '@/lib/money'

async function addExpense(formData: FormData){
  'use server'
  await prisma.expense.create({data:{category:String(formData.get('category')),amount:Number(formData.get('amount')),description:String(formData.get('description')||''),paymentMethod:formData.get('paymentMethod') as any || 'CASH'}})
}

export default async function ExpensesPage(){
  const expenses = await prisma.expense.findMany({orderBy:{date:'desc'},take:100})
  return <><h1>Витрати</h1><form action={addExpense}><h2>Додати витрату</h2><div className="formgrid"><input className="input" name="category" placeholder="Категорія: оренда, ZUS, реклама..." required/><input className="input" name="amount" type="number" step="0.01" placeholder="Сума" required/><select name="paymentMethod"><option value="CASH">Готівка</option><option value="CARD">Карта</option><option value="TRANSFER">Переказ</option></select><input className="input" name="description" placeholder="Опис"/></div><button className="btn">Зберегти</button></form><table className="table"><thead><tr><th>Дата</th><th>Категорія</th><th>Сума</th><th>Опис</th></tr></thead><tbody>{expenses.map(e=><tr key={e.id}><td>{e.date.toLocaleString('pl-PL')}</td><td>{e.category}</td><td>{money(e.amount)}</td><td>{e.description}</td></tr>)}</tbody></table></>
}
