# Аудит дизайна и UI/UX — Startup Engine (frontend)

> Полный аудит текущего визуального стиля frontend-проекта. Только исследование, без изменений кода.
> Проект: `/home/poicho/AKS/Kolya_v2/frontend` (React 18 + shadcn/ui + Tailwind CSS).

---

## 1. Архитектура frontend — карта

**Framework/стек** (`frontend/package.json`):

- **React 18.3.1** + **TypeScript 5.7.2** + **Vite 5.4.11** (сборка `tsc && vite build`).
- **shadcn/ui — ДА** (`frontend/components.json`: `style: "default"`, `baseColor: "slate"`, `cssVariables: true`, `iconLibrary: "lucide"`).
- Доп. UI-библиотеки: **Radix UI** (dialog, popover, select, separator, slot, tabs — `package.json:14-19`), **class-variance-authority**, **tailwind-merge**, **clsx**, **tailwindcss-animate**, **sonner** (тосты), **react-day-picker v10**, **lucide-react**, **recharts 2.13**.
- **Tailwind CSS 3.4.15** + `tailwindcss-animate` (`tailwind.config.js`, `postcss.config.js`).
- Стейт: Zustand (`store/authStore.ts`) + TanStack React Query (`lib/queryClient.ts`). Роутинг: react-router-dom 6. i18n: i18next (ru/en).

**Глобальная тема / CSS-переменные**: `frontend/src/index.css` — `:root` (светлая) и `.dark`, включая `--chart-1..5`.

**Theme-провайдер**: `src/components/theme-provider.tsx` (defaultTheme="dark", storageKey="startup-engine-theme"), `theme-toggle.tsx`.

**UI-компоненты** (`src/components/ui/`): `badge`, `button`, `calendar`, `card`, `confirm-dialog`, `date-picker`, `input`, `month-picker`, `select`, `separator`, `skeleton`, `tabs` (12 файлов).

**Страницы** (`src/pages/`): `Landing`, `Login`, `Register`, `InvitePage`, `Dashboard`, `CompaniesDashboard`, `CompanyDetail`, `Recommendations`, `Forecast`, `Settings`, `NotFound`.

**Layout**: `src/components/common/Layout.tsx` (sidebar + header + `<main>`), `ProtectedRoute.tsx`, `ErrorBoundary.tsx`, `QueryState.tsx`.

**Navigation/sidebar/header**: `Layout.tsx` (sidebar `w-64`, header `sticky top-0`).

**Dashboard**: `Dashboard.tsx` — только диспетчер ролей (редиректит); реальный дашборд — `CompaniesDashboard.tsx` + `CompanyLifecycleSections.tsx`.

**Формы**: внутри вкладок (`BudgetTab`, `CohortsTab`, `HiringTab`, `MarketTab`, `TasksTab`, `CompanyOnboardingWizard`, `CompanyConfigDialog`, `Recommendations`, `Forecast`, `Register`).

**Таблицы**: **raw `<table>`**, компонента shadcn `Table` НЕТ (в `ui/` отсутствует `table.tsx`). Используются в `CompanyDetail.tsx` (метрики), `BudgetTab`, `CohortsTab`, `CreditTab`, `HiringTab`, `SensitivityTab`.

**Графики**: Recharts ТОЛЬКО в `Forecast.tsx` (`ComposedChart`). Во всех 13 вкладках компании графиков нет.

**Onboarding/auth**: `Login`, `Register`, `InvitePage`, `CompanyOnboardingWizard` (inline-карта, не модалка), `CompanyConfigDialog`, `StartupInvite`.

**Настройки**: `Settings.tsx` (профиль + подписка/тарифы).

**13 вкладок компании** (`CompanyDetail.tsx:501-513` → `src/components/company/`): Метрики (inline в CompanyDetail), Когорты, Бюджет, Юнит-экономика, Задачи, Рынок, Найм, P&L, Cash Flow, Кредиты, Оценка, Чувствительность, Отчёты + общий блок `AIInsight.tsx`.

---

## 2. Визуальный стиль

**Цветовая система** — токены в `index.css:8-61`. Реальные значения (конвертация в hex):

| Токен | Light | Dark |
|---|---|---|
| `--background` | `0 0% 100%` (#fff) | `222.2 84% 4.9%` (#020617 ≈ slate-950) |
| `--foreground` | `222.2 84% 4.9%` (#020617) | `210 40% 98%` (#f8fafc) |
| `--card` | #fff | #020617 (= background!) |
| `--popover` | #fff | #020617 |
| `--primary` | `221.2 83.2% 53.3%` = **#2563eb (blue-600)** | `217.2 91.2% 59.8%` = **#3b82f6 (blue-500)** |
| `--primary-foreground` | `210 40% 98%` | `222.2 47.4% 11.2%` |
| `--secondary` | `210 40% 96.1%` (#f1f5f9, slate-100) | `217.2 32.6% 17.5%` (#1e293b, slate-800) |
| `--muted` | = secondary | = secondary |
| `--muted-foreground` | `215.4 16.3% 46.9%` (#64748b, slate-500) | `215 20.2% 65.1%` (#94a3b8, slate-400) |
| `--accent` | slate-100 | slate-800 |
| `--destructive` | `0 84.2% 60.2%` (#ef4444, red-500) | `0 62.8% 30.6%` |
| `--border` | `214.3 31.8% 91.4%` (#e2e8f0, slate-200) | slate-800 |
| `--input` | = border | = border |
| `--ring` | = primary (#2563eb) | `224.3 76.3% 48%` (indigo) |
| `--chart-1..5` | blue / green / orange / purple / pink | blue / green / orange / purple / pink |

**Semantic-цвета фактически отсутствуют как токены**: `success`/`warning` токенов нет. Позитив/успех реализован через **хардкод `emerald-500`**, негатив — через `--destructive` (см. раздел 19).

**Ключевая аномалия**: `--primary` светлой темы **темнее** (`#2563eb`), чем тёмной (`#3b82f6`) — инверсия привычной логики.

**Декоративные цвета** (хардкод, минуя токены): `slate-950`, `slate-300/400`, `white/5..80`, `black/45..80`, `blue-600`, `amber-50/700/200`, `orange-50`, `purple-50/700/200`, `emerald-500/600`, `red-500`, `green-400`, `#3b82f6`, `#10b981` (см. раздел 19).

**Консистентность цветовой системы — НИЗКАЯ** (главная проблема проекта).

---

## 3. Typography

**Font-family**: `Inter` (Google Fonts, веса 300–800, `index.css:1`), `font-sans: ["Inter", ...defaultTheme]` (`tailwind.config.js:67`). Fallback — системный sans-стек Tailwind. `font-mono` точечно (`StartupInvite.tsx:59`).

| Элемент | size/weight/line-height | Где |
|---|---|---|
| H1 страницы | `text-2xl font-bold tracking-tight` (24px/700) | `CompaniesDashboard:49`, `CompanyDetail:443` |
| H1 (без tracking-tight!) | `text-2xl font-bold` | `Recommendations:80`, `Forecast:100`, `Settings:34` |
| H2 auth | `text-2xl font-bold` | `Login:80`, `Register:128` |
| CardTitle | `text-2xl font-semibold leading-none tracking-tight` | `card.tsx:39` |
| Заголовок секции | `font-semibold text-foreground` (16px) | все вкладки |
| Body / подзаголовок | `text-sm text-muted-foreground` (14px) | везде |
| Labels форм | `text-sm font-medium` или `text-xs font-medium` | разнобой (см. 19) |
| KPI-значение | `text-2xl font-bold` | `CompaniesDashboard:75` |
| Метрика-тайл | `text-xl`/`text-2xl`/`text-lg` (разнобой) | см. 19 |
| Badge | `text-xs font-semibold` | `badge.tsx:7` |
| Caption/подпись | `text-xs text-muted-foreground` | везде |
| Ошибка | `text-sm text-destructive` | везде |

**Иерархия**: H1(24/700) → секция(16/600) → тело(14) → подпись(12). Числовые метрики крупные и жирные. Letter-spacing задаётся только через `tracking-tight` (заголовки) и `tracking-wider` (uppercase-подписи KPI/тайлов). Проблема: `tracking-tight` на H1 используется **непоследовательно** (3 страницы с ним, 3 без).

---

## 4. Spacing system

**Единой системы нет** — значения в основном от Tailwind-шкалы, но с заметным разнобоем:

- **Page padding**: `Layout.tsx:155` `<main className="p-6">` (24px). Но `CompaniesDashboard:46` и `CompanyDetail:440` добавляют свой `p-4 sm:p-6` → **двойной отступ 48px**. `Recommendations/Forecast/Settings` полагаются только на Layout (24px).
- **Card content**: `p-5` (все вкладки, KPI) vs `p-6` (формы Recommendations/Forecast/Settings) vs `p-8` (auth-карты) vs `p-3` (мини-тайлы) vs `p-4` (панели форм/тайлы). Итог: 5 разных значений.
- **Gap между карточками**: `space-y-6` (24px) в большинстве, но `space-y-3` в `AIInsight.tsx:52`.
- **Отступ заголовка карточки**: `mb-5` (Budget/Cohorts/Tasks/Unit) vs `mb-4` (CashFlow/Credit/Hiring/Market/PnL/Sensitivity/Valuation) vs `mb-3` (Tasks readiness) vs `mb-2` (Reports).
- **Форма → поля**: `space-y-4` (16px); label→input: `mb-1`/`space-y-2` (8px).
- **Панель формы**: `mb-6 p-4 border border-border rounded-lg bg-muted/30`.
- **Label/input расстояние**: `mb-1` (4px) или `space-y-2` (8px) — разнобой.

---

## 5. Border radius

`--radius: 0.75rem` (`index.css:28`). Из `tailwind.config.js:61-65`:

- `rounded-lg` = 12px, `rounded-md` = 10px, `rounded-sm` = 8px.

| Элемент | radius |
|---|---|
| Кнопки | `rounded-md` (10px) — `button.tsx:8` |
| Inputs/Selects | `rounded-md` (10px) |
| Cards | `rounded-lg` (12px) |
| Диалоги | `rounded-lg` (12px) |
| Dropdown/Popover | `rounded-lg` (12px) |
| Badge | `rounded-full` |
| Avatars/логотипы | `rounded-xl` (12px) / `rounded-2xl` (16px) |
| Навигация (sidebar items) | `rounded-xl` (12px) |
| Таблицы | нет скругления |
| Тайлы/панели | `rounded-lg` (12px) |
| Тепловая ячейка когорт | `rounded` (4px!) — `CohortsTab:275` |

**Коллизия**: `rounded-lg` = `var(--radius)` = 12px **совпадает** с фиксированным Tailwind `rounded-xl` (12px) — разные классы дают одинаковый радиус (карточки `rounded-lg`, иконки-чипы `rounded-xl`). Единственный выброс — когортная ячейка `rounded` (4px).

---

## 6. Shadows / borders / effects

- **Box-shadow**: `shadow-sm` (карточки, `card.tsx:12`), `shadow-md`/`shadow-lg`/`shadow-xl` (логотип), `shadow-primary-500/20-30` (цветная тень логотипа), `shadow-lg` (диалог), `shadow` (активный таб).
- **Borders**: единый 1px `border-border`; тонкие варианты `border-border/50` (строки таблиц), `border-border/70` (строки компаний).
- **Opacity/alpha поверхностей**: `bg-card/50` (карточки), `bg-card/40`, `bg-muted/30` (панели форм), `bg-muted/40` (hover строк/результат AI), `bg-black/80` (оверлей диалога).
- **Backdrop blur**: только `backdrop-blur-sm` на header (`Layout.tsx:105`). Больше нигде.
- **Gradients**: логотип `from-primary-500 to-blue-600` (фактически плоский, см. 19), аватар `from-slate-700 to-slate-800`, бейджи тарифов `from-amber-50 to-orange-50` и `from-purple-50 to-blue-50`, оверлеи Landing `from-black/70 via-black/45`.
- **Glow/glassmorphism**: glassmorphism только на Landing (белые альфа-утилиты на тёмном). Glow — нет.

**Характер интерфейса**: **Enterprise SaaS, dashboard-heavy, flat, с лёгкими тенями (shadow-sm) и тонкими 1px-границами** — ближе к Linear/Vercel по «чистоте», но без их полировки. Тёмная тема — первичная (defaultTheme="dark").

---

## 7. shadcn/ui audit

**Используемые компоненты shadcn** (стоковые, почти без изменений):

- `Button` — сток + `link` вариант. **Изменения: НЕТ** (default/destructive/outline/secondary/ghost/link; `[&_svg]:size-4`).
- `Input` — сток (h-10, rounded-md, ring-2).
- `Card` + Header/Title/Description/Content/Footer — сток, но везде переопределяется `bg-card/50` + `p-5`/`p-6`/`p-8`.
- `Badge` — сток (default/secondary/destructive/outline).
- `Tabs` — сток (но 13 триггеров без скролла — см. 13).
- `Select` — сток (но в табах **не используется**, вместо него нативные `<select>`).
- `Skeleton` — сток.
- `Separator` — сток.

**Кастомные (написаны вручную, не из shadcn CLI)**:

- `calendar.tsx` — react-day-picker **v10** с `style.css` + свои classNames (стоковый shadcn calendar использует v9 + tailwind-классы).
- `confirm-dialog.tsx` — кастомный на Radix Dialog.
- `date-picker.tsx`, `month-picker.tsx` — кастомные на Radix Popover.

**Дублирующиеся реализации**:

- **Нативный `<select>` клонирован 4 раза** с рукописным стилем вместо shadcn `Select` (`BudgetTab:108`, `CohortsTab:153`, `TasksTab:116`, `MarketTab:74/89/104`, `Register:34-35`).
- **Диалоги написаны дважды**: `confirm-dialog.tsx` и `CompanyConfigDialog.tsx` (оба на Radix Dialog, но `ConfigDialog` не использует обёртку).
- **Кнопка-ссылка в `ReportsTab:27/35`** — рукописный `<a>` с копией стиля `Button outline`, но с другим hover (`hover:bg-muted/40` вместо `hover:bg-accent`).

**Визуальные конфликты**: см. раздел 19 (positive/negative цвета, размеры тайлов, отступы заголовков).

**Отсутствуют (не используются, хотя Radix установлен)**: `Table`, `Form`, `Label`, `Textarea`, `Checkbox`, `Switch`, `RadioGroup`, `DropdownMenu`, `Tooltip`, `Sheet`, `Alert`, `Avatar`, `Progress`, `Command`, `Sidebar`, `Collapsible`. Toast — напрямую `sonner` (не shadcn-обёртка).

---

## 8. Buttons

Единый `Button` (`button.tsx`) на CVA. Сток shadcn:

| Вариант | Стиль | Размеры (default) |
|---|---|---|
| default | `bg-primary text-primary-foreground hover:bg-primary/90` | h-10 (40px), `px-4 py-2` |
| destructive | `bg-destructive ... hover:bg-destructive/90` | — |
| outline | `border border-input bg-background hover:bg-accent` | — |
| secondary | `bg-secondary hover:bg-secondary/80` | — |
| ghost | `hover:bg-accent hover:text-accent-foreground` | — |
| link | `text-primary underline-offset-4 hover:underline` | — |
| Размеры | default h-10; **sm** h-9 px-3; **lg** h-11 px-8; **icon** h-10 w-10 | |

- **Icon size**: `[&_svg]:size-4` принудительно 16px внутри любой кнопки (перебивает `w-5 h-5`).
- **Radius**: `rounded-md` (10px) — везде, кроме sidebar-nav (переопределено на `rounded-xl` в `Layout.tsx:63`).
- **Typography**: `text-sm font-medium`.
- **Focus**: `focus-visible:ring-2 ring-ring ring-offset-2`. **Disabled**: `opacity-50`.
- **Hover**: `bg-primary/90` (default), `bg-accent` (ghost/outline).

**Нарушения/инлайн-оверрайды**: `px-8` дублирует lg (`Landing:101/106`); `w-full` на submit/analyze; `text-destructive hover:text-destructive` (логаут `Settings:117`); `border-white/20 bg-white/5 text-white` (Landing outline). **Loading** — не через Button, а иконка `<Loader2 className="animate-spin">` внутри (`CompanyDetail:474/484`, `Recommendations:173`).

---

## 9. Forms

**Единого form-паттерна нет.** Обзор по контролам:

- **Input** (`input.tsx`): h-10, rounded-md, `border-input bg-background px-3 py-2 text-sm`, placeholder `text-muted-foreground`, focus ring-2. Но в проекте почти везде переопределён на `bg-card border-input` (избыточно, т.к. `--card = --background`). Один тяжёлый оверрайд в `CompanyDetail:544` (border-0 bg-transparent h-8 w-24 + сброс спиннера).
- **Select**: shadcn `Select` используется только в `Recommendations`, `Forecast`, `CompanyOnboardingWizard`, `CompanyConfigDialog`. В 4 табах + Register — **нативный `<select>`** без focus-ring и chevron.
- **Checkbox/Radio/Switch**: компонентов нет. Checkbox = нативный `h-4 w-4` (`OnboardingWizard:284`, `ConfigDialog:211`). Radio = кастомные кнопки-карточки `rounded-lg border` с состоянием `border-primary bg-primary/10`.
- **Textarea**: не используется.
- **Date picker / Month picker**: кастомные `date-picker.tsx` (react-day-picker) и `month-picker.tsx`.
- **Upload**: нет. **Search**: нет.
- **Label**: компонента shadcn `Label` нет. Используются `<label className="...">` (Hiring — `text-xs font-medium`, Market — `text-xs` без font-medium) **или вообще без label** (placeholder+aria-label в Budget/Cohorts/Tasks). **Разнобой 3 способов**.
- **Helper text**: `text-xs text-muted-foreground mt-1` (Forecast, Onboarding).
- **Validation/error**: `required`+`minLength` нативно (Login/Register) или тихое отключение кнопки Save (табы). Единственная инлайн-ошибка — `AIInsight.tsx:65`. Баннеры ошибок: `bg-destructive/10 border-destructive/20` (Recommendations/Forecast) или `bg-red-500/10 border-red-500/20` (Login/Register — хардкод).
- **Success**: только баннеры `emerald` на Login/Register (хардкод `emerald-500/600`).

---

## 10. Cards

`Card` (`card.tsx`): `rounded-lg border bg-card text-card-foreground shadow-sm` + `CardHeader p-6` + `CardContent p-6 pt-0` + `CardFooter p-6 pt-0`.

Фактически визуально различаются **~6 типов карточек**:

1. **Стандартная контентная** — `border bg-card/50` + `p-5` (все вкладки, KPI-карточки). Доминирующая.
2. **KPI/метрик-карточка** — та же обёртка + иконка-чип `w-10 h-10 rounded-xl bg-primary/10 text-primary` + label `text-xs uppercase tracking-wider` + value `text-2xl font-bold` (`CompaniesDashboard:70-79`).
3. **Формовая** (Recommendations/Forecast/Settings) — `border` + `p-6`.
4. **Auth-карточка** — `border bg-card` + `p-8 pt-8` (`Login/Register/Invite`).
5. **Стат-тайл** — `rounded-lg border border-border p-4` + uppercase label + `text-xl/2xl` value (не Card, а div; PnL/Credit/Hiring/Sensitivity/Unit/Valuation).
6. **Панель формы** — `mb-6 p-4 border border-border rounded-lg bg-muted/30` (Budget/Cohorts/Tasks/CompanyDetail bulk).

Header/footer карточек почти не используются (только `CardHeader pb-4` в `CompanyLifecycleSections`). Hover — только у карточек рекомендаций `hover:shadow-md transition-all` (`Recommendations:217`) и строк-компаний.

---

## 11. Dashboard

Композиция (после авторизации → `Layout` → `/dashboard` → `CompaniesDashboard`):

1. **Sidebar** (`Layout.tsx:39`): `w-64` (256px), `fixed`, `bg-background border-r`, логотип-градиент, 4 nav-пункта, блок пользователя внизу.
2. **Header** (`Layout.tsx:105`): `sticky top-0 bg-background/80 backdrop-blur-sm border-b px-6 py-4`, справа бейдж тарифа + ThemeToggle.
3. **Page** (`CompaniesDashboard:46`): `space-y-6 p-4 sm:p-6`.
4. **Заголовок** (`:47-50`): H1 `text-2xl font-bold tracking-tight` + подзаголовок muted + 2 кнопки (Refresh outline, «+» default).
5. **KPI-грид** (`:68`): `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` — 4 карточки (компании, ср. выручка, % on-track, behind). Без тренд-индикаторов.
6. **Список компаний** (`CompanyLifecycleSections`): 2 секции (Active/Архив) с div-строками `rounded-lg border p-4 hover:bg-muted/30`, статус-пилюли, действия.

**Иерархия внимания**: (1) заголовок + действие «добавить компанию», (2) KPI-метрики, (3) список компаний со статусами. Хлебных крошек **нет нигде**. Уведомлений-баннеров в дашборде нет (только sonner-тосты глобально).

---

## 12. Navigation

- **Sidebar**: ширина `w-64` (256px), `fixed`, скрыт ниже `md` (`hidden md:flex`).
- **Nav-items**: `Button ghost w-full justify-start gap-3 px-4 py-2.5 rounded-xl text-sm font-medium` (`Layout.tsx:60-67`); активный `bg-muted text-foreground`, неактивный `text-muted-foreground hover:bg-muted/50`.
- **Иконки nav**: `w-5 h-5`.
- **Active indicator**: заливка `bg-muted` (не primary-акцент).
- **Мобильная навигация**: hamburger `Menu` (`Layout.tsx:106-137`), раскрывающийся блок; **активный пункт на мобилке иной** — `bg-primary/10 text-primary` (не `bg-muted`) — неконсистентность с десктопом.
- **Tabs** (навигация внутри страницы): shadcn `Tabs` (`tabs.tsx`), `TabsList h-10 bg-muted rounded-lg p-1`, активный `bg-background shadow`. **13 табов в одной строке без скролла** → переполнение на узких экранах.
- **Collapsed state sidebar**: нет (не реализован).
- **Header**: фиксирован `sticky`, `z-10`.

---

## 13. Responsive design

Брейкпоинты — только стандартные Tailwind (`sm: 640`, `md: 768`, `lg: 1024`). Явных кастомных брейкпоинтов нет.

- **Sidebar**: скрыт `< md`, заменяется hamburger. Контент `md:ml-64`.
- **Гриды**: KPI `md:grid-cols-2 lg:grid-cols-4`; тарифы `md:grid-cols-2 lg:grid-cols-4`; поля форм `sm:grid-cols-2`.
- **Таблицы**: адаптивность только через скрытие колонок `hidden sm:table-cell` (`CompanyDetail:740/743`) и `overflow-x-auto` (не у всех: у Budget/Sensitivity его нет).
- **Карточки/типографика/формы**: дефолтные.

**Проблемы responsive**:

1. **13 табов переполняют строку** (нет скролла/переноса) — `CompanyDetail:499-514`.
2. Forecast summary-грид `grid-cols-3` **не схлопывается** на мобилке (`Forecast:239`).
3. Таблицы без `overflow-x-auto` (Budget, Sensitivity) обрежутся/сломают layout.
4. Двойной page-padding на `CompaniesDashboard`/`CompanyDetail` (24+24px).

---

## 14. Animations

- Плагин `tailwindcss-animate` подключён, но **keyframes `accordion-*` из `tailwind.config.js:69-82` нигде не используются**.
- Реально используются: `animate-spin` (Loader2/RefreshCw), `animate-pulse` (Skeleton), `transition-colors`/`transition-all`/`transition-opacity` + `duration-200`.
- Анимации диалогов/popover/select: штатные Radix + `data-[state=open]:animate-in fade-in-0 zoom-in-95` (в `select.tsx`, `confirm-dialog.tsx`, `date-picker`).
- **Единой motion-системы нет** — длительности разрознены (150ms Radix по умолчанию, 200ms в проекте), easing не задан явно.

---

## 15. Icons

- **Библиотека**: **lucide-react** (единственная, `iconLibrary: "lucide"` в `components.json`). Смешения библиотек нет.
- **Размеры**: `w-4 h-4` (16px) — стандарт в кнопках/строках; `w-5 h-5` (20px) — в sidebar-nav, заголовках секций, KPI-чипах; `w-3 h-3` — в бейдже active-плана.
- **Stroke-width**: не переопределяется (дефолт lucide 2).
- **Несогласованность**: внутри кнопок `[&_svg]:size-4` принудительно 16px, что игнорирует явные `w-5 h-5`; порядок классов `w-4 h-4` vs `h-4 w-4` хаотичен (без визуального эффекта, но признак небрежности).
- Инлайн-SVG (логотип-щит) дублируется в `Layout.tsx`, `Login.tsx`, `Register.tsx`, `InvitePage.tsx`, `Landing.tsx` (5 копий).

---

## 16. Tables / Data visualization

- **Таблицы**: raw `<table>`, шрифт `text-sm`. Заголовок `border-b border-border text-muted-foreground`, th `px-4 py-3 text-left font-medium` (у когорт `px-3 py-3`). Строки `border-b border-border/50 hover:bg-muted/40`. **Zebra — нет, числовые значения выровнены влево (не вправо), `tabular-nums` нет.**
- **Графики**: Recharts только в `Forecast.tsx` — `ComposedChart` (Line historical + Line forecast + Area confidence), высота `h-80` (320px), `CartesianGrid strokeDasharray="3 3"`, stock `Tooltip`/`Legend` без кастомизации. **Цвета захардкожены hex** `#3b82f6` / `#10b981` (не адаптируются к теме), токены `--chart-1..5` **не используются**.
- **KPI**: карточки с крупными числами (см. 11).
- **Progress**: реального `Progress` нет; готовность — текст `N%` (`CompanyLifecycleSections:109`), прогресс онбординга — 4 сегмента `h-1 bg-primary/bg-muted` (`OnboardingWizard:138-143`), usage-meter — самодельный `h-2 bg-muted` + inline `width%` (`Settings:102-107`).
- **Status-индикаторы**: пилюли-бейджи (см. 19).

---

## 17. Empty / Loading / Error states

- **Единый враппер `QueryState.tsx`**: loading = `space-y-4 p-4` + 3 скелетона; error = карточка `border-destructive/40 bg-destructive/5` + retry; empty = `bg-muted/30` + текст. **Хорошее решение**, но используется непоследовательно:
  - Табы в `CompanyDetail` оборачиваются в QueryState — но внутри табов свои скелетоны разных размеров (`h-6 w-64/48/56/40` + `h-72/64/24/20`) — 6 разных вариантов.
  - `Settings` loading = просто `Loader2` + текст (не скелетон).
  - `Recommendations`/`Forecast` — loading только в кнопке (спиннер), пустого состояния нет.
  - `CompaniesDashboard` секции — loading/empty через plain `<p>`, не скелетоны.
- **Confirmation**: `ConfirmDialog` (danger-вариант) используется в Budget/Cohorts/CompanyDetail, **но НЕ в TasksTab** (удаление сразу, без подтверждения).
- **Success**: только баннеры на Login/Register; в табах после сохранения — только sonner-тост.

---

## 18. Dark / Light theme

Обе темы определены полностью (`index.css`). Default = **dark**. Toggle есть в header (`ThemeToggle`).

**Найденные баги темизации**:

1. **`Toaster theme="dark"` захардкожен** (`App.tsx:77`) — в светлой теме тосты останутся тёмными.
2. **Landing полностью захардкожен тёмным** (`slate-950` + white-альфы) — не переключается, и в светлой теме останется тёмным (возможно, намеренно, но не через токены).
3. **Бейджи тарифов Business/Enterprise** в `Layout.tsx:146/149` используют светлые хардкод-цвета (`amber-50`, `purple-50`, `text-amber-700`, `border-amber-200`) — в **тёмной теме выглядят сломанно** (светлый фон на тёмном, нечитаемо).
4. **Диаграмма Forecast** с хардкодом `#3b82f6`/`#10b981` не адаптируется; сетка/оси Recharts остаются дефолтно-светлыми в тёмной теме.
5. `--card = --background` в обеих темах → `bg-card/50` и `bg-card` **не дают визуальной разницы** на фоне (декоративный no-op).

Контраст в целом приемлем (slate-950/slate-50), но `text-green-400` на белом (`Forecast:253`) — низкий контраст; `text-primary-200` на тёмном Landing — фактически полно-синий (см. 19.1).

---

## 19. UX-консистентность — найденные анти-паттерны

**19.1. Критическая ошибка токенов**: в `tailwind.config.js:21-35` оттенки `primary.50..950` **все указывают на один и тот же `hsl(var(--primary))`**. Следствия:

- Градиент логотипа `from-primary-500 to-blue-600` в светлой теме = **плоский цвет** (blue-600 → blue-600, градиента нет). `Layout.tsx:42`, `Login:72`, `Register:120`, `Invite:51`, `Landing:44/79`.
- `text-primary-200` (`Landing:88`), `text-primary-600/700/800` (`Recommendations:200/203/208`) — **всё рендерится как полнонасыщенный blue-600**, т.е. «светлые»/«тёмные» оттенки не работают.

**19.2. Positive/negative цвета — 4 разные системы**:

- Стандарт: `text-emerald-500` / `text-destructive` (Budget, CashFlow, PnL, Sensitivity, Unit).
- Когорты: raw `bg-red-500/20 text-red-700`, `text-emerald-700`, `text-amber-700` (`CohortsTab:36-38`) — единственные `red-*` и `-700` оттенки.
- Tasks: `text-blue-500` для in_progress (`TasksTab:15`) — единственный синий.
- Market: GDP без цвета, хардкод `+` (`MarketTab:138`); Credit: только негатив красным; PnL-маржи вообще без цвета.

**19.3. Размер метрических тайлов — 4 конкурирующих масштаба**: `text-2xl` (PnL/Sensitivity/Unit), `text-xl` (Credit/Hiring/Valuation), `text-lg font-semibold` (Market/Tasks/Unit-retention), `text-3xl` (Tasks readiness).

**19.4. Заголовок H1**: `tracking-tight` есть в CompaniesDashboard/CompanyDetail, отсутствует в Recommendations/Forecast/Settings.

**19.5. Labels форм — 3 конвенции**: с `font-medium` (Hiring), без `font-medium` (Market), вообще без label (Budget/Cohorts/Tasks).

**19.6. Нативный `<select>` — 5 копий** вместо shadcn `Select`, без focus-ring.

**19.7. Отступ заголовка карточки**: `mb-5` vs `mb-4` vs `mb-3` vs `mb-2` (см. раздел 4).

**19.8. Удаление**: `size="icon"` ghost (Budget/Cohorts) vs `size="sm"` ghost (Tasks); с ConfirmDialog (Budget/Cohorts/CompanyDetail) vs без (Tasks).

**19.9. Кнопка «Analyze/AI»**: `outline` (AIInsight) vs `default w-full` (Market) — одно действие, два стиля.

**19.10. Хардкод-цвета** (полный реестр): `blue-600`, `blue-50`, `slate-700/800/300/400/950`, `amber-50/700/200`, `orange-50`, `purple-50/700/200`, `emerald-500/600/700`, `red-500/700`, `green-400`, `white/5..80`, `black/45..80`, hex `#3b82f6`/`#10b981` — в `Landing.tsx`, `Layout.tsx`, `Login.tsx`, `Register.tsx`, `Forecast.tsx`, `CohortsTab.tsx`, `CompanyDetail.tsx`, `CompanyLifecycleSections.tsx`.

**19.11. Дублирование кода**: `Row`/`Section` в CashFlow продублированы инлайн в PnL (`PnLTab:19-32`, `:83/95/107`); инлайн-SVG логотипа ×5; нативный select ×5; радио-кнопки региона продублированы в OnboardingWizard/ConfigDialog с разным padding (`px-4 py-3` vs `px-3 py-2`) и разным focus-ring.

**19.12. Inline-styles**: единственный `style={{width: ...%}}` в `Settings.tsx:105-107`. Arbitrary values: `min-h-[60vh]` (×2), `max-h-[calc(100vh-2rem)]`, `w-[calc(100%-2rem)]`, `[appearance:textfield]`, `w-[min(20rem,calc(100vw-2rem))]`.

**19.13. i18n-обход**: хардкод английских метрик в PnL (`EBITDA`, `Net margin`), Sensitivity (`MRR/CAC/LTV/...`), Unit (`LTV/CAC`, `Magic Number`, `Runway`...), Market (`MRR/CAC/Churn`), Cohorts (`M1..M12`) — при том, что всё вокруг через `t()`.

**19.14. Двойной page-padding** (Layout `p-6` + `p-4 sm:p-6`) на CompaniesDashboard/CompanyDetail.

---

## 20. Design tokens (восстановление)

| TOKEN | CURRENT VALUE | WHERE USED | CONSISTENCY |
|---|---|---|---|
| **Colors / primary** | `#2563eb` (light) / `#3b82f6` (dark) | кнопки, ссылки, фокус | ⚠ инверсия светлее/темнее; шкала 50-950 сломана |
| **Colors / background** | #fff / #020617 | body, страницы | ✅ |
| **Colors / card** | = background | все карточки | ⚠ no-op (`bg-card/50` невидим) |
| **Colors / muted** | slate-100 / slate-800 | панели, hover, вторичный фон | ✅ |
| **Colors / muted-foreground** | slate-500 / slate-400 | вторичный текст | ✅ |
| **Colors / destructive** | #ef4444 / тёмно-красный | ошибки, негатив | ⚠ позитив (emerald) не токенизирован |
| **Colors / success** | — (хардкод emerald-500) | отклонения, статусы | ❌ отсутствует |
| **Colors / warning** | — (хардкод amber-500) | когорты | ❌ отсутствует |
| **Colors / chart** | `--chart-1..5` заданы | — | ❌ не используются (hex в Forecast) |
| **Typography / font** | Inter 300-800 | глобально | ✅ |
| **Typography / H1** | 24px/700 | страницы | ⚠ tracking-tight непоследователен |
| **Typography / body** | 14px | везде | ✅ |
| **Spacing / page** | p-6 (24px) | Layout | ⚠ двойной padding на 2 страницах |
| **Spacing / card content** | p-5 / p-6 / p-8 / p-3 / p-4 | карточки | ❌ 5 значений |
| **Spacing / gap** | space-y-6 / space-y-4 / space-y-3 | секции | ⚠ |
| **Spacing / header mb** | mb-5 / mb-4 / mb-3 / mb-2 | карточки | ❌ |
| **Radius / base** | 0.75rem (12px) | — | ✅ |
| **Radius / элементы** | md(10)/lg(12)/xl(12)/2xl(16)/full | компоненты | ⚠ rounded-lg = rounded-xl |
| **Shadows** | shadow-sm (карты), primary/20 (лого) | карточки, лого | ✅ |
| **Borders** | 1px border-border | везде | ✅ |
| **Sizes / control** | h-10 (40px) input/button, h-9 sm | формы | ✅ |
| **Breakpoints** | sm/md/lg Tailwind | гриды | ✅ |
| **Motion** | 200ms / Radix 150ms | переходы | ⚠ нет единой системы |

---

## 21. Итоговая оценка (1–10)

| Критерий | Балл |
|---|---|
| Visual quality | 6 |
| UX | 6 |
| Consistency | **4** |
| Typography | 7 |
| Color system | **5** |
| Spacing | **5** |
| Component system | 6 |
| Responsive | **5** |
| Accessibility | **4** |
| shadcn/ui implementation | **5** |
| **Общий балл** | **≈ 5.3 / 10** |

---

## 22. CURRENT DESIGN DESCRIPTION

**Общий характер.** Startup Engine — это **тёмно-ориентированный enterprise SaaS-дашборд** для акселераторов/венчурных фондов: аналитическая B2B-панель с высокой плотностью данных (метрики, таблицы, статусы, AI-блоки). Визуально — **flat-дизайн с тонкими границами и лёгкими тенями**, в духе Linear/Vercel, но без их полировки и строгой системы.

**Настроение.** Сдержанное, профессиональное, «финтех-аналитика». Без излишнего декора: мало градиентов, нет стекла (кроме полупрозрачного sticky-хедера и тёмного Landing), нет glow. Информация важнее украшений.

**Цвета.** Базовый акцент — **синий** (`#2563eb` в светлой, `#3b82f6` в тёмной теме). Фон — почти чёрный `#020617` (dark) или белый (light). Карточки визуально не отделяются от фона цветом (card = background), а только границей и лёгкой тенью. Вторичный фон — холодный серо-синий (slate-100/slate-800). Вторичный текст — приглушённый серый. Позитивные значения — **зелёный (emerald-500)**, негативные — **красный (red-500/destructive)**, предупреждения — редкий **янтарный**. Таргетные бейджи планов используют светлые пастельные градиенты (amber/purple) — инородные в тёмной теме.

**Типографика.** Единый шрифт **Inter**. Заголовки крупные, жирные, с плотным межбуквенным интервалом (`tracking-tight`); тело 14px; подписи и лейблы 12px. Числа-метрики — большие и жирные (20–30px). Бейджи — 12px semi-bold в форме пилюль. Иерархия: заголовок страницы → заголовок секции → тело → подпись.

**Формы.** Прямоугольные контролы высотой 40px, радиус 10px, тонкая граница, фокус — синее кольцо (ring-2). Инпуты и нативные селекты (без стрелки/фокуса у селектов — недоработка). Чекбоксы — нативные. Радио-выборы — карточки с рамкой, выбранное состояние — синяя рамка + лёгкая синяя заливка. Лейблы непоследовательны (есть/нет/разные размеры). Валидация — тихая (кнопка Save гаснет) либо баннеры.

**Карточки.** Тонкая граница + `shadow-sm` + радиус 12px. Внутренние отступы 20px (стандарт вкладок) или 24–32px (формы/авторизация). Внутри карточек — «стат-тайлы» (маленькие квадраты с uppercase-подписью 12px и крупным числом) и «панели форм» (светло-серая заливка 30% с рамкой).

**Навигация.** Слева фиксированный **sidebar 256px**: логотип-градиент, 4 пункта с иконками 20px, активный пункт — серой заливкой. Сверху sticky-хедер с полупрозрачным blur-фоном, бейджем тарифа и переключателем темы. Внутри компании — **13 вкладок** в пилюльной строке (заголовок секции → контент).

**Dashboard.** Сверху заголовок + кнопки действий; ниже 4 KPI-карточки (иконка-чип + подпись + крупное число); ниже список компаний со статус-пилюлями (зелёный on-track / красный behind / серый no-data) и действиями.

**Таблицы.** Простые, без зебры, заголовки серым, строки с тонкими разделителями и лёгким серым hover. Числа выровнены влево (не вправо). Колонки адаптивно скрываются. Есть лёгкий «кружевной» вид за счёт полупрозрачных границ.

**Графики.** Минимально: один прогнозный график (Recharts) — синяя сплошная линия (история), зелёная пунктирная (прогноз), светло-зелёная зона доверия, дефолтные оси и тултипы.

**Кнопки.** 6 вариантов (primary синяя, destructive красная, outline, secondary, ghost, link). Высота 40px, радиус 10px, шрифт 14px medium, иконки 16px. Hover — затемнение/серое. Disabled — 50% прозрачность.

**Интеракции.** Переходы 200ms на цвет/тень; спиннеры (animate-spin) при загрузке; пульсирующие скелетоны; штатные Radix-анимации диалогов/поповеров (fade+zoom). Микро-интеракций мало.

**Плотность и отступы.** Средне-высокая плотность: отступы 16–24px между секциями, 20px внутри карточек. Нет единого ритма — отступы заголовков и паддинги варьируются.

**Responsive.** Sidebar схлопывается в hamburger на `<768px`; гриды перестраиваются; таблицы частично скрывают колонки. Слабые места: 13 вкладок без скролла, не-схлопывающийся грид прогноза.

---

## 23. DESIGN DNA

1. **Dark-first enterprise SaaS** — тёмная тема по умолчанию, аналитическая плотность.
2. **Inter, заголовки bold + tracking-tight** — компактная типографика.
3. **Синий #2563eb как единственный акцент** — кнопки, ссылки, фокус, логотип.
4. **Тонкие 1px-границы вместо контрастных карточек** — карточки не отличаются цветом от фона, только рамкой + shadow-sm.
5. **Радиус 12px (карты) / 10px (контролы) / full (пилюли-бейджи)**.
6. **Зелёный = рост/позитив, красный = падение/риск** — семантика отклонений «План vs Факт».
7. **Пилюльные статус-бейджи** (rounded-full, 12px, semi-bold) с полупрозрачной заливкой цвета.
8. **Высота контролов 40px, иконки 16px** — стандартный размер интерактивных элементов.
9. **Метрики-числа крупные и жирные**, подписи — uppercase 12px muted.
10. **Светло-серые панели форм (bg-muted/30 + border)** внутри карточек.
11. **Flat-эстетика**: минимум градиентов, без стекла/glow, тени только лёгкие (sm).
12. **Sidebar 256px + sticky header с blur** — фиксированный каркас приложения.

---

## 24. Финальный вывод

**1. Как сейчас выглядит продукт?**
Как функционально богатый, но визуально неотполированный enterprise SaaS-дашборд: профессиональный скелет (shadcn, Inter, синий акцент, чистые карточки) с заметными швами — разнобой отступов, размеров, семантических цветов и хардкод-палитры.

**2. На что похож?**
На раннюю версию Linear / Vercel Dashboard / стандартный «shadcn стартер» с синей темой; аналитические вкладки — на типовые финансовые BI-панели (P&L/Cash Flow). Landing — на типичный тёмный SaaS-hero с видео.

**3. Что уже хорошо?**
- Единый стек и структура (shadcn + Tailwind + токены для большинства элементов).
- Чистая базовая типографика (Inter, внятная иерархия).
- Единый `QueryState` для loading/error/empty.
- Единый `Button` с полным набором вариантов.
- Логичная каркасная навигация (sidebar + header + tabs).
- Сдержанный flat-стиль без «дешёвого» излишества.

**4. Что выглядит дёшево/устаревшим?**
- Сломанные градиенты логотипа (плоский цвет из-за бага токенов).
- Бейджи тарифов со светлыми пастельными градиентами (инородны, ломаются в тёмной теме).
- Дефолтные Recharts-тултипы/оси и жёстко закодированные цвета графиков.
- Нативные селекты без стрелок и focus-ring рядом со стилизованными инпутами.
- Не-адаптивная строка из 13 вкладок.

**5. Что непоследовательно?**
Размеры метрик-тайлов (4 масштаба), семантические цвета (4 системы positive/negative), отступы заголовков (mb-2..5), паддинги карточек (p-3..8), лейблы форм (3 конвенции), дублирование кода (select×5, Row/Section, лого×5, диалоги×2), hardcoded-цвета против токенов.

**6. 10 изменений с максимальным визуальным эффектом:**

1. Починить шкалу `primary` в `tailwind.config.js` (дать 50–950 реальные значения) — восстановит все градиенты и оттенки.
2. Ввести токены `--success`/`--warning` и заменить все хардкод `emerald/amber/red` на них.
3. Унифицировать размер метрик-тайлов и статус-пилюль в один `MetricCard`/`StatusBadge` компонент.
4. Унифицировать отступы заголовков карточек (`mb-4` везде) и паддинги (p-5).
5. Заменить нативные `<select>` на shadcn `Select` (убрать 5 копий).
6. Починить темизацию: `Toaster` без хардкода dark, бейджи тарифов через токены, графики через `--chart-*`.
7. Сделать строку из 13 вкладок скроллируемой/переносимой.
8. Заменить рукописный `<a>`-button в Reports на `Button asChild`.
9. Ввести единый `Label` и применить его во всех формах.
10. Устранить двойной page-padding (вынести в Layout единый контейнер).

**7. Что нужно для premium modern SaaS:**
Единая дизайн-система: полные токены (включая success/warning/chart-оттенки + реальная шкала primary), унифицированные примитивы (MetricCard, StatusBadge, DataTable, Label, EmptyState), консистентный motion (150–200ms с единым easing), корректная тёмная/светлая адаптация всех элементов, выровненные числа в таблицах (right-align + tabular-nums), полированные состояния (focus/hover/disabled/loading) везде одинаково.

**8. Что изменить в shadcn/ui:**
- `Card` — вынести переопределение `bg-card/50 p-5` в вариант по умолчанию (или убрать no-op alpha).
- Добавить недостающие `Table`, `Label`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `Progress`, `Tooltip`, `Alert`, `Avatar` — и использовать вместо рукописных.
- `Tabs` — добавить overflow/scroll для длинных списков.
- `Select` — использовать вместо нативных `<select>`.
- `Dialog` — завести стоковый `dialog.tsx` и переписать `CompanyConfigDialog`/`confirm-dialog` на него.

**9. Какие компоненты унифицировать:**
`MetricCard`/`StatTile` (4 размера → 1), `StatusBadge` (4 системы цвета → 1), `Select` (5 нативных копий → shadcn), `Label` (3 конвенции → 1), `EmptyState` (table-row vs `<p>` → 1), `Section`/`Row` (дубли CashFlow/PnL → общий), `DownloadButton` (ручной `<a>` → Button), логотип (5 копий SVG → 1 компонент).

**10. Какие design tokens создать:**
`--success` (+ `-foreground`), `--warning` (+ `-foreground`), `--info`, полная шкала `primary-50..950`, `--radius-*` (карта/контрол/пилюля раздельно), `--spacing-card` (p-5), `--spacing-section` (mb-4), единые `--duration`/`--easing` для motion, `--font-size-metric` для KPI, а также использовать существующие `--chart-1..5` в графиках вместо hex.
