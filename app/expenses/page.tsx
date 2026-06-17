import { expenses, money } from '../data';

export default function ExpensesPage() {
  return (
    <>
      <h2>Витрати</h2>
      <div className="form">
        <input className="input" placeholder="Категорія" />
        <input className="input" placeholder="Сума" />
        <input className="input" placeholder="Опис" />
        <button>Додати витрату</button>
      </div>
      <table>
        <thead><tr><th>Дата</th><th>Категорія</th><th>Сума</th><th>Опис</th></tr></thead>
        <tbody>
          {expenses.map(e => <tr key={e.id}><td>{e.date}</td><td>{e.category}</td><td>{money(e.amount)}</td><td>{e.description}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}
