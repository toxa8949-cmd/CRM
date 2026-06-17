import { products, money } from '../data';

export default function ProductsPage() {
  return (
    <>
      <h2>Товари</h2>
      <div className="form">
        <input className="input" placeholder="Назва товару" />
        <input className="input" placeholder="Закупка" />
        <input className="input" placeholder="Ціна продажу" />
        <input className="input" placeholder="Кількість" />
        <button>Додати товар</button>
      </div>
      <table>
        <thead><tr><th>Назва</th><th>Категорія</th><th>Залишок</th><th>Закупка</th><th>Продаж</th></tr></thead>
        <tbody>
          {products.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.category}</td><td>{p.stock}</td><td>{money(p.purchase)}</td><td>{money(p.price)}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}
