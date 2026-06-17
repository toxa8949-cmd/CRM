export const products = [
  { id: 1, name: 'Kugoo Kirin GT2', category: 'Електросамокати', stock: 4, purchase: 2800, price: 3999 },
  { id: 2, name: 'Rower MTB 29', category: 'Велосипеди', stock: 7, purchase: 1200, price: 1999 },
  { id: 3, name: 'Покришка 29x2.25', category: 'Запчастини', stock: 18, purchase: 45, price: 89 },
];

export const sales = [
  { id: 1, date: '2026-06-17', product: 'Kugoo Kirin GT2', qty: 1, amount: 3999, profit: 1079 },
  { id: 2, date: '2026-06-17', product: 'Покришка 29x2.25', qty: 2, amount: 178, profit: 83 },
  { id: 3, date: '2026-06-16', product: 'Rower MTB 29', qty: 1, amount: 1999, profit: 739 },
];

export const expenses = [
  { id: 1, date: '2026-06-17', category: 'Бухгалтер', amount: 300, description: 'Приклад витрати' },
  { id: 2, date: '2026-06-16', category: 'Реклама', amount: 120, description: 'Facebook Ads' },
];

export const money = (v: number) => `${v.toLocaleString('pl-PL')} zł`;
