import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main(){
  await prisma.product.createMany({data:[
    {name:'Kukirin GT2',category:'Електросамокати',sku:'KUK-GT2',purchasePrice:2800,salePrice:4000,quantity:4},
    {name:'Шина 10x3',category:'Запчастини',sku:'TIRE-10X3',purchasePrice:45,salePrice:100,quantity:20},
    {name:'Гальмівні колодки',category:'Запчастини',sku:'BRAKE-PADS',purchasePrice:18,salePrice:55,quantity:30}
  ], skipDuplicates:true})
  await prisma.expense.create({data:{category:'Бухгалтер',amount:300,description:'Приклад витрати'}})
}
main().finally(()=>prisma.$disconnect())
