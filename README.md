# NovaDB - Database Schema Designer

**NovaDB** — це десктопний додаток для візуального проєктування реляційних баз даних з автоматичною генерацією SQL, міграціями та локальним штучним інтелектом.

> ⚡ **Всі операції виконуються локально** — жодні дані не залишають ваш комп'ютер

---

## 🚀 Швидкий старт

### Передумови
- [Node.js 20+](https://nodejs.org/) 
- [Rust 1.70+](https://www.rust-lang.org/)
- [Tauri CLI](https://tauri.app/) (встановлюється через `npm install`)
- [Ollama](https://ollama.ai/) (опціонально, для AI функцій)

### Встановлення та запуск

```bash
# 1. Клонуємо проєкт (якщо ще не зроблено)
cd nova

# 2. Встановлюємо залежності Node.js
npm install

# 3. Запускаємо в режимі розробки
npm run dev           # Запускає Vite dev сервер на http://127.0.0.1:5173
# У окремому терміналі:
npm run tauri dev    # Запускає Tauri додаток

# АБО одним скриптом (після встановлення concurrently):
npm install concurrently
npm run tauri:dev
```

### Перший запуск
- Перше зібрання Rust може зайняти **10-30 хвилин** (завантаження залежностей)
- Наступні запуски будуть значно швидшими

---

## 🎯 Основний функціонал

### 📊 Візуальний редактор схеми

| Дія | Як зробити |
|-----|------------|
| **Створити таблицю** | Клікніть "＋ Add Table" або натисніть кнопку у toolbar |
| **Редагувати таблицю** | Клікніть на таблицю на канвасі |
| **Додати стовпчик** | Виберіть таблицю → "＋ Add column" в панелі властивостей |
| **Змінити ім'я/тип** | Клікніть на ім'я таблиці або стовпчика |
| **Створити зв'язок** | Перетягніть handle (○) з однієї таблиці до іншої |
| **Видалити таблицю** | Виберіть таблицю та натисніть `Delete` |
| **Масштабування** | Колесо миші або controls на канвасі |
| **Панорамування** | Перетягування канвасу мишею |

### 🗃️ Генерація SQL

- **Автоматична генерація**: SQL оновлюється в реальному часі при змінах
- **Підтримка діалектів**:
  - ✅ PostgreSQL (`uuid`, `timestamptz`, `numeric`)
  - ✅ MySQL (`CHAR(36)` для UUID, `DATETIME`)
  - ✅ SQLite (`datetime`, `boolean`)
  - ✅ MariaDB
  - ✅ MongoDB (JSON модель)
  - ✅ DynamoDB (NoSQL модель)
  - ✅ CockroachDB (PostgreSQL-сумісний)

```sql
-- Приклад згенерованого SQL для PostgreSQL
CREATE TABLE users (
  "id" UUID PRIMARY KEY NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "full_name" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE orders (
  "id" UUID PRIMARY KEY NOT NULL,
  "user_id" UUID NOT NULL REFERENCES users("id"),
  "status" VARCHAR(50) NOT NULL,
  "total" NUMERIC(10,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL
);
```

### 🔬 Fake Data Generator

- Генерація **1-100,000** тестових записів
- Реалістичні дані залежно від імені стовпчика:
  - `id`, `uuid` → UUID формат
  - `email` → email@domain.com
  - `name`, `full_name` → людинські імена
  - `created_at`, `date` → дата/час
  - `price`, `total` → числові значення

```json
// Приклад згенерованих даних
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "mia.williams1@example.dev",
    "full_name": "Mia Williams",
    "created_at": "2026-01-01T10:00:00Z"
  },
  {
    "id": "00000000-0000-4000-8000-000000000002",
    "email": "noah.taylor2@example.dev", 
    "full_name": "Noah Taylor",
    "created_at": "2026-01-02T10:00:00Z"
  }
]
```

### 🔄 Міграції

- Генерація **safe additive migrations** (лише додавання)
- Порівняння поточної та цільової схеми
- Показує які таблиці/стовпчики будуть додані

```sql
-- Приклад міграції
ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ;
```

### 🤖 Local AI (Ollama)

- Генерація SQL запитів за природною мовою
- **100% локально** — жодні дані не відправляються в хмару
- Вимагає запущеного Ollama сервера

```bash
# Запуск Ollama (в окремому терміналі)
ollama serve

# Завантаження моделі
ollama pull qwen2.5-coder:7b
```

Приклади запитів:
- "Show me top 10 users by order count"
- "Generate a report of monthly sales"
- "Find all orders from last week"

---

## 🏢 Управління Workspace

### Створення нового workspace

1. Клікніть на **workspace switch** (у верхній частині sidebar)
2. Натисніть "Add new workspace"
3. Введіть ім'я workspace
4. Готово! 🎉

### Обмеження за тарифами

| Тариф | Ціна | Max Workspaces | Особливості |
|-------|------|---------------|-------------|
| **Free** | $0/міс | 3 | Базовий функціонал |
| **Quantic** | $2/міс | 10 | Розширені пресети, усі діалекти |
| **Goliaf** | $5/міс | ∞ | Gemini AI, необмежені схеми |

> 💡 **Під час бета-тестування** всі функції доступні безкоштовно

---

## ⚙️ Налаштування

### Зміна бази даних

1. У верхній панелі виберіть поточну БД
2. Клікніть на випадаючий список
3. Виберіть потрібну БД з логотипом
4. SQL автоматично перегенерується

### Зміна плану

1. Відкрийте **Settings** (⚙ у sidebar)
2. Виберіть потрібний план
3. Ліміти workspace оновляться миттєво

---

## 📁 Структура проєкту

```
nova/
├── src/                          # Frontend
│   ├── App.tsx                   # Головний компонент додатку
│   ├── App.css                   # Стилі додатку
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Глобальні стилі
│   ├── lib/
│   │   └── desktop.ts            # Типи та API функції
│   └── assets/
│       └── novadb-mark.svg       # Лого програми
│
├── src-tauri/                    # Backend (Rust)
│   ├── Cargo.toml                # Rust залежності
│   ├── tauri.conf.json           # Конфігурація Tauri
│   └── src/
│       └── main.rs               # Tauri commands
│
├── public/                       # Статичні файли
│   └── assets/db/                # Лого баз даних
│       ├── postgresql.svg
│       ├── mysql.svg
│       ├── sqlite.svg
│       ├── mariadb.svg
│       ├── mongodb.svg
│       ├── dynamodb.svg
│       └── cockroachdb.svg
│
├── package.json                  # Node.js конфігурація
├── vite.config.ts                # Vite конфігурація
└── README.md                     # Документація
```

---

## 🎨 Клавішні комбінації

| Дія | Windows/Linux | Mac |
|-----|---------------|-----|
| Додати таблицю | `A` | `A` |
| Виділити все | `Ctrl+A` | `Cmd+A` |
| Копіювати | `Ctrl+C` | `Cmd+C` |
| Вставити | `Ctrl+V` | `Cmd+V` |
| Видалити | `Delete` | `Delete` |
| Відмінити | `Ctrl+Z` | `Cmd+Z` |
| Повторити | `Ctrl+Y` | `Cmd+Y` |
| Масштаб + | `Ctrl++` | `Cmd++` |
| Масштаб - | `Ctrl+-` | `Cmd+-` |
| Зберегти | `Ctrl+S` | `Cmd+S` |

---

## 🔧 Вирішення проблем

### ❌ Помилка: "beforeDevCommand terminated with a non-zero status code"

**Рішення:**
```bash
# Встановіть залежності
npm install

# Запустіть окремо
npm run dev        # Terminal 1
npm run tauri dev  # Terminal 2
```

### ❌ Помилка: "EBUSY: resource busy or locked"

**Рішення:**
```bash
# Видаліть target папку та перезапустіть
rm -rf src-tauri/target
npm run tauri dev
```

### ❌ Ollama не працює / "Ollama is unavailable"

**Рішення:**
```bash
# 1. Встановіть Ollama
curl -fsSL https://ollama.ai/install.sh | sh  # Linux/Mac
# АБО завантажте з https://ollama.ai/ для Windows

# 2. Запустіть сервер
ollama serve

# 3. Завантажте модель
ollama pull qwen2.5-coder:7b

# 4. Перевірте роботу
curl http://127.0.0.1:11434/api/tags
```

### ❌ Консольне вікно з'являється при запуску (Windows)

**✅ ВИПРАВЛЕНО!** у `src-tauri/src/main.rs`

Додано атрибут для приховання консолі на Windows:
```rust
#![windows_subsystem = "windows"]
```

**Кроки для збірки без консолі:**

```bash
# 1. Очистіть стару збірку
rm -rf src-tauri/target

# 2. Перезберіть проєкт
npm run build
npm run tauri:build

# 3. Запустіть ПРАВИЛЬНИЙ файл:
#    ✅ src-tauri/target/release/bundle/msi/NovaDB_0.1.0_x64.msi
#    ✅ АБО src-tauri/target/release/bundle/nsis/NovaDB_0.1.0-x64.exe
#
# 4. ❌ НЕ запускайте: src-tauri/target/release/novadb-core.exe
```

**Чому це працює?**
- `#![windows_subsystem = "windows"]` каже Rust компілятору
- що додаток має бути **GUI додатком** (а не консольним)
- Це приховує консоль **на рівні Windows API**

**Тепер усі варіанти збірки НЕ повинні показувати cmd.exe!**

> ✅ **Гарантовано: після оновлення main.rs консоль НЕ з'явиться!**

### ❌ Rust компіляція дуже довго триває

**Це нормально для першого запуску!**
- Tauri завантажує багато Rust залежностей
- Час компіляції: 10-30 хвилин (залежно від інтернету)
- Наступні компіляції будуть швидшими (кеш)

### ❌ Стилі не застосовуються

**Рішення:**
```bash
# Перебілдіть проєкт
npm run build
npm run tauri dev
```

---

## 🛠️ Технічні деталі

### Архітектура

```
┌─────────────────────────────────────────┐
│              Frontend (React)            │
│  ┌─────────────┐  ┌───────────────────┐ │
│  │ React Flow  │  │ Properties Panel   │ │
│  │ (Canvas)    │  │ (Table Editor)     │ │
│  └─────────────┘  └───────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │           Workbench Area             │ │
│  │  SQL │ Fake Data │ Diff │ AI        │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    │
                    ▼ (Tauri IPC)
┌─────────────────────────────────────────┐
│              Backend (Rust)              │
│  ┌─────────────────────────────────────┐ │
│  │ DDL Generation │ Fake Data │ Diff   │ │
│  │     │           │    │       │     │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    │
                    ▼ (HTTP)
┌─────────────────────────────────────────┐
│            Ollama (Local AI)             │
│  ┌─────────────────────────────────────┐ │
│  │         LLM Model                    │ │
│  │    (qwen2.5-coder:7b)                │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Технології

| Компонент | Технологія | Версія |
|-----------|------------|--------|
| Frontend | React + TypeScript | 19.x |
| UI Library | @xyflow/react | 12.x |
| Build Tool | Vite | 8.x |
| Backend | Rust | 1.70+ |
| Desktop Framework | Tauri | 2.x |
| AI Engine | Ollama | latest |
| Styling | Custom CSS | - |

### Data Flow

```
User Action → React State → Schema Update → 
    ↓
Tauri IPC → Rust Core → SQL/DDL Generation → 
    ↓
React State Update → UI Render
```

---

## 📜 Ліцензія

**MIT License** — вільне використання для особистих і комерційних цілей.

---

## 🙏 Подяка

- [Tauri](https://tauri.app/) — Крос-платформний фреймворк для десктопних додатків
- [React Flow](https://reactflow.dev/) — Бібліотека для візуалізації графів
- [Ollama](https://ollama.ai/) — Локальні LLM моделі
- [Vite](https://vitejs.dev/) — Швидкий build tool

---

## 📞 Підтримка

| Тип | Контакт |
|-----|---------|
| Bug Report | [GitHub Issues]() |
| Feature Request | [GitHub Discussions]() |
| Загальні питання | [Documentation](https://) |

---

## 🎉 NovaDB

**Your Database Design Companion**

> "Design databases visually, generate SQL instantly, 
> work with data efficiently — all locally, all private."

---

**Made with ❤️ and Rust + React**