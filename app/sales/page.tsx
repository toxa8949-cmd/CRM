import { prisma } from '@/lib/prisma'
import { calcTax, money } from '@/lib/money'

async function addSale(formData: FormData){
  'use server'
  const productId = Number(formData.get('productId'))
  const quantity = Number(formData.get('quantity') || 1)
  const salePrice = Number(formData.get('salePrice'))
  const discount = Number(formData.get('discount') || 0)
  const product = await prisma.product.findUniqueOrThrow({where:{id:productId}})
  if(product.quantity < quantity) throw new Error('Недостатньо товару на складі')
  const total = salePrice * quantity - discount
  const purchase = Number(product.purchasePrice) * quantity
  const tax = calcTax(total)
  const profit = total - purchase - tax
  await prisma.$transaction([
    prisma.sale.create({data:{totalAmount:total,taxAmount:tax,profitAmount:profit,paymentMethod:formData.get('paymentMethod') as any || 'CASH',note:String(formData.get('note')||''),items:{create:{productId,quantity,purchasePrice:product.purchasePrice,salePrice,discount,profit}}}}),
    prisma.product.update({where:{id:productId},data:{quantity:{decrement:quantity}, status: product.quantity - quantity <= 0 ? 'SOLD' : 'IN_STOCK'}})
  ])
}

export default async function SalesPage(){
  const [products,sales] = await Promise.all([prisma.product.findMany({where:{quantity:{gt:0}},orderBy:{name:'asc'}}),prisma.sale.findMany({orderBy:{date:'desc'},include:{items:{include:{product:true}}},take:50})])
  return <><h1>Продажі</h1><form action={addSale}><h2>Новий продаж</h2><div className="formgrid"><select name="productId" required>{products.map(p=><option key={p.id} value={p.id}>{p.name} — залишок {p.quantity} — {money(p.salePrice)}</option>)}</select><input className="input" name="quantity" type="number" defaultValue="1" min="1"/><input className="input" name="salePrice" type="number" step="0.01" placeholder="Ціна продажу" required/><input className="input" name="discount" type="number" step="0.01" placeholder="Знижка"/><select name="paymentMethod"><option value="CASH">Готівка</option><option value="CARD">Карта</option><option value="TRANSFER">Переказ</option></select><input className="input" name="note" placeholder="Нотатка"/></div><button className="btn">Продати</button></form><table className="table"><thead><tr><th>Дата</th><th>Товар</th><th>Сума</th><th>Податок</th><th>Прибуток</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{s.date.toLocaleString('pl-PL')}</td><td>{s.items.map(i=>i.product.name).join(', ')}</td><td>{money(s.totalAmount)}</td><td>{money(s.taxAmount)}</td><td className="ok">{money(s.profitAmount)}</td></tr>)}</tbody></table></>
}
