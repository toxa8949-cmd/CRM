# Rower CRM MVP

CRM/POS для магазину: товари, продажі, склад, витрати, звіти, приблизний розрахунок ryczałt 3%.

## Що вже є

- Додавання товарів
- Продаж товару
- Автоматичне зменшення залишку
- Витрати
- Звіти за день і місяць
- Залишок складу
- Розрахунок податку `ryczałt` від обороту
- Розрахунок прибутку: продаж − закупка − податок − витрати

## Технології

- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma

## Запуск локально

Потрібно встановити:

- Node.js 20+
- PostgreSQL
- Git

### 1. Скопіювати `.env.example` у `.env`

```bash
cp .env.example .env
```

У `.env` зміни підключення до бази:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rower_crm?schema=public"
TAX_RATE="0.03"
```

### 2. Встановити залежності

```bash
npm install
```

### 3. Створити таблиці в базі

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```

### 4. Запустити сайт

```bash
npm run dev
```

Відкрити:

```text
http://localhost:3000
```

## Як загрузити в GitHub

### Варіант через термінал

Створи новий репозиторій на GitHub, наприклад `rower-crm`, потім у папці проєкту виконай:

```bash
git init
git add .
git commit -m "Initial Rower CRM MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rower-crm.git
git push -u origin main
```

Заміни `YOUR_USERNAME` на свій GitHub логін.

### Варіант через сайт GitHub

1. Зайди на GitHub.
2. Натисни **New repository**.
3. Назва: `rower-crm`.
4. Не додавай README, бо він уже є в проєкті.
5. Завантаж файли з цього архіву або зроби push через термінал.

## Що додати далі

- логін/пароль
- повернення товару
- клієнти
- постачальники
- імпорт/експорт Excel
- сканер штрихкодів
- ролі працівників
- деплой на Vercel/VPS
