import { products, sales, expenses, money } from './data';

export default function Dashboard() {
  const todaySales = sales.filter(s => s.date === '2026-06-17');
  const revenue = todaySales.reduce((sum, s) => sum + s.amount, 0);
  const profit = todaySales.reduce((sum, s) => sum + s.profit, 0);
  const tax = Math.round(revenue * 0.03);
  const stockValue = products.reduce((sum, p) => sum + p.stock * p.purchase, 0);

  return (
    <>
      <h2>Панель керування</h2>
      <p className="muted">Перша проста версія CRM. Дані поки тестові, без бази.</p>
      <div className="grid">
        <div className="card"><h3>Продажі сьогодні</h3><div className="value">{money(revenue)}</div></div>
        <div className="card"><h3>Прибуток сьогодні</h3><div className="value">{money(profit)}</div></div>
        <div className="card"><h3>Податок 3%</h3><div className="value">{money(tax)}</div></div>
        <div className="card"><h3>Закупівельна вартість складу</h3><div className="value">{money(stockValue)}</div></div>
      </div>
    </>
  );
}
