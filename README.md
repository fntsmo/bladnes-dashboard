# Bladnes × Turbo — Production Dashboard (Supabase)

Дашборд заказов для производства одежды с облачным хранением данных.
Данные доступны с любого устройства и не теряются.

---

## Шаг 1 — Создайте проект в Supabase (бесплатно)

1. Зайдите на https://supabase.com и нажмите **Start your project**
2. Войдите через GitHub (или создайте аккаунт)
3. Нажмите **New Project**
4. Заполните:
   - **Name**: `bladnes-dashboard`
   - **Database Password**: придумайте пароль (запишите)
   - **Region**: выберите ближайший (например `EU West`)
5. Нажмите **Create new project** — подождите ~2 минуты

## Шаг 2 — Создайте таблицу

1. В Supabase Dashboard откройте **SQL Editor** (иконка в левом меню)
2. Нажмите **New query**
3. Вставьте этот SQL и нажмите **Run**:

```sql
-- Таблица заказов
CREATE TABLE orders (
  uid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL,
  invoice TEXT DEFAULT '',
  product TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  qty INTEGER DEFAULT 0,
  launch_date DATE,
  due_date DATE,
  stage TEXT DEFAULT 'Разработка',
  ship_date DATE,
  pay_percent INTEGER DEFAULT 0,
  month TEXT NOT NULL,
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Разрешаем чтение и запись без авторизации (для простоты)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON orders FOR ALL USING (true) WITH CHECK (true);

-- Демо-данные
INSERT INTO orders (order_id, invoice, product, amount, qty, launch_date, due_date, stage, ship_date, pay_percent, month, comment) VALUES
  ('ОРД-2401', 'СЧ-0012', 'Худи оверсайз Urban',         485000, 200, '2026-01-10', '2026-02-15', 'Отгружен',               '2026-02-14', 100, '2026-01', 'Отгружено без замечаний.'),
  ('ОРД-2402', 'СЧ-0013', 'Футболка базовая (3 цвета)',   312000, 500, '2026-01-15', '2026-02-20', 'Отгружен',               '2026-02-19', 100, '2026-01', ''),
  ('ОРД-2403', 'СЧ-0014', 'Брюки карго Tactical',         567000, 300, '2026-01-20', '2026-03-01', 'Упаковка',               NULL,          70, '2026-01', 'Ждём упаковочный материал.'),
  ('ОРД-2404', 'СЧ-0018', 'Свитшот с вышивкой',           290000, 150, '2026-02-01', '2026-03-10', 'В производстве',         NULL,          50, '2026-02', 'Вышивка согласована.'),
  ('ОРД-2405', 'СЧ-0019', 'Жилет утеплённый Arctic',      723000, 120, '2026-02-05', '2026-03-20', 'Доставка материалов',    NULL,          50, '2026-02', ''),
  ('ОРД-2406', 'СЧ-0020', 'Шорты спортивные (5 цветов)',  198000, 400, '2026-02-12', '2026-03-15', 'Согласование образцов',  NULL,          30, '2026-02', 'Образцы отправлены клиенту.'),
  ('ОРД-2407', 'СЧ-0021', 'Куртка-бомбер Retro',          845000, 100, '2026-02-18', '2026-04-01', 'Изготовление образцов',  NULL,          30, '2026-02', ''),
  ('ОРД-2408', 'СЧ-0025', 'Платье-рубашка Minimal',       410000, 180, '2026-03-01', '2026-04-10', 'Разработка',             NULL,          20, '2026-03', ''),
  ('ОРД-2409', 'СЧ-0026', 'Тренч Classic',                960000,  80, '2026-03-05', '2026-04-20', 'Разработка',             NULL,           0, '2026-03', 'Ожидаем ТЗ по фурнитуре.'),
  ('ОРД-2410', 'СЧ-0027', 'Поло базовое (4 цвета)',       276000, 350, '2026-03-10', '2026-04-15', 'Разработка',             NULL,           0, '2026-03', '');
```

## Шаг 3 — Скопируйте ключи

1. В Supabase Dashboard откройте **Settings** → **API** (или нажмите **Connect**)
2. Скопируйте:
   - **Project URL** — похож на `https://abcdefgh.supabase.co`
   - **anon public key** — длинная строка начинается с `eyJ...`

## Шаг 4 — Настройте проект

1. Скачайте и распакуйте ZIP-архив
2. В папке проекта скопируйте `.env.local.example` → `.env.local`
3. Откройте `.env.local` в текстовом редакторе и вставьте ваши ключи:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Шаг 5 — Запустите локально

```bash
npm install
npm run dev
```

Откройте http://localhost:3000 — данные подтянутся из Supabase.

## Шаг 6 — Задеплойте на Vercel

1. Залейте проект на GitHub (без файла `.env.local`!)
2. Зайдите на https://vercel.com → **Add New** → **Project**
3. Выберите ваш репозиторий
4. **ВАЖНО**: перед деплоем нажмите **Environment Variables** и добавьте:
   - `NEXT_PUBLIC_SUPABASE_URL` = ваш URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = ваш ключ
5. Нажмите **Deploy**
6. Получите публичную ссылку — отправьте клиенту

## Что даёт Supabase

- ✅ Данные хранятся в облаке — не зависят от браузера
- ✅ Доступ с любого устройства по одной ссылке
- ✅ Бесплатно до 500 МБ и 50 000 строк
- ✅ Можно добавить авторизацию (логин/пароль) позже
- ✅ Автоматические бэкапы

## Структура проекта

```
bladnes-turbo-dashboard/
├── app/
│   ├── layout.js
│   ├── page.js
│   └── globals.css
├── components/
│   └── Dashboard.js      ← весь дашборд
├── lib/
│   └── supabase.js        ← подключение к Supabase
├── .env.local.example     ← шаблон переменных
├── package.json
└── next.config.js
```
