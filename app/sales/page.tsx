import { sales, money } from '../data';

export default function SalesPage() {
  return (
    <>
      <h2>Продажі</h2>
      <div className="form">
        <input className="input" placeholder="Товар" />
        <input className="input" placeholder="Кількість" />
        <input className="input" placeholder="Ціна продажу" />
        <button>Продати</button>
      </div>
      <table>
        <thead><tr><th>Дата</th><th>Товар</th><th>К-сть</th><th>Сума</th><th>Прибуток</th></tr></thead>
        <tbody>
          {sales.map(s => <tr key={s.id}><td>{s.date}</td><td>{s.product}</td><td>{s.qty}</td><td>{money(s.amount)}</td><td>{money(s.profit)}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}
