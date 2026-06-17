import { sales, expenses, money } from '../data';

export default function ReportsPage() {
  const revenue = sales.reduce((sum, s) => sum + s.amount, 0);
  const profit = sales.reduce((sum, s) => sum + s.profit, 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const tax = Math.round(revenue * 0.03);
  const net = profit - expenseTotal - tax;

  return (
    <>
      <h2>Звіти</h2>
      <div className="grid">
        <div className="card"><h3>Дохід</h3><div className="value">{money(revenue)}</div></div>
        <div className="card"><h3>Маржа</h3><div className="value">{money(profit)}</div></div>
        <div className="card"><h3>Витрати</h3><div className="value">{money(expenseTotal)}</div></div>
        <div className="card"><h3>Податок 3%</h3><div className="value">{money(tax)}</div></div>
        <div className="card"><h3>Чистий результат</h3><div className="value">{money(net)}</div></div>
      </div>
    </>
  );
}
