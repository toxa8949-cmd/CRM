import { prisma } from '@/lib/prisma'
import { money } from '@/lib/money'

async function addProduct(formData: FormData){
  'use server'
  await prisma.product.create({data:{
    name:String(formData.get('name')),
    category:String(formData.get('category') || ''),
    sku:String(formData.get('sku') || `SKU-${Date.now()}`),
    purchasePrice:Number(formData.get('purchasePrice')),
    salePrice:Number(formData.get('salePrice')),
    quantity:Number(formData.get('quantity') || 0)
  }})
}

export default async function ProductsPage(){
  const products = await prisma.product.findMany({orderBy:{createdAt:'desc'}})
  return <><h1>Товари</h1><form action={addProduct}><h2>Додати товар</h2><div className="formgrid"><input className="input" name="name" placeholder="Назва" required/><input className="input" name="category" placeholder="Категорія"/><input className="input" name="sku" placeholder="Артикул/SKU"/><input className="input" name="purchasePrice" type="number" step="0.01" placeholder="Закупка" required/><input className="input" name="salePrice" type="number" step="0.01" placeholder="Продаж" required/><input className="input" name="quantity" type="number" placeholder="Кількість" required/></div><button className="btn">Зберегти</button></form><table className="table"><thead><tr><th>Назва</th><th>Категорія</th><th>SKU</th><th>Закупка</th><th>Продаж</th><th>Залишок</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.category}</td><td>{p.sku}</td><td>{money(p.purchasePrice)}</td><td>{money(p.salePrice)}</td><td>{p.quantity}</td></tr>)}</tbody></table></>
}
