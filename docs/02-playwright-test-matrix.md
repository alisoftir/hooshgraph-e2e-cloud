# ماتریس تست Playwright هوش‌گراف — دستی و هوشمند

## بسته‌ها

| چیز | مسیر |
|-----|------|
| سورس تست | `projects/hooshgraph/e2e-cloud/` |
| ZIP آماده | `projects/hooshgraph/exports/hooshgraph-e2e-cloud.zip` |
| env نمونه | `.env.e2e.example` (هرگز توکن را commit نکن) |
| کرون ۶ ساعته | `python scripts/hooshgraph_e2e_cloud_run.py --run` |

## نصب روی سیستم خودت

```powershell
cd path\to\hooshgraph-e2e-cloud
copy .env.e2e.example .env.e2e.local
# HG_E2E_TOKEN را از پنل (Sanctum token کاربر تست) بگذار
npm install
npx playwright install chromium
```

## انواع اجرا — دقیقاً همان‌هایی که خواستی

### ۱) دستی (UI headed) — خودت ببین

```powershell
npx playwright test --headed --grep @p0
# یا فقط یک فایل:
npx playwright test tests/p0-public-and-trial.spec.ts --headed
```

UI مرورگر باز می‌شود؛ قدم‌به‌قدم ببین کجا می‌شکند.

### ۲) هوشمند / اتوماتیک کامل (@p0)

```powershell
npm run test:p0
# معادل:
npx playwright test --grep @p0
```

این همان سوئیتی است که کرون ۶ ساعته می‌زند (به‌علاوه ایمیل آلارم).

گزارش HTML:

```powershell
npm run report
```

### ۳) فقط دیتابیس‌ها

Deep-link ویزارد دیتابیس + API مرتبط:

```powershell
npx playwright test --grep "database|db_engine|kind=database"
```

دستی در مرورگر:

`https://hooshgraph.com/panel/cloud/create?mode=manual&kind=database&db_engine=mysql`

### ۴) فقط پروژه‌های ابری (cloud projects)

```powershell
npx playwright test --grep "cloud|deploy|wizard|trial|source-upload|Cloud"
```

فایل‌های اصلی:

- `p0-public-and-trial.spec.ts`
- `p0-deploy-health.spec.ts`
- `p0-source-upload-to-git.spec.ts`
- `p1-wizard-branches.spec.ts`
- بخش cloud در `p0-customer-retention.spec.ts`

### ۵) فقط پلتفرم ابری / پلتفرم محصول (نه PaaS مشتری)

این بخش بیشتر «سلامت پلتفرم» است تا ساخت پروژه:

```powershell
npx playwright test --grep "Login|Auth|wallet|notifications|brands|panel"
```

فایل‌ها:

- `p0-auth-and-notifications.spec.ts`
- `p0-customer-retention.spec.ts` (مسیرهای نگهداری مشتری)

### ۶) شاخه‌های ویزارد جدا

| شاخه | دستور / URL |
|------|-------------|
| دستی | `--grep manual` یا `?mode=manual` |
| هوشمند/AI | `--grep "AI|mode=ai"` یا `?mode=ai` |
| یک‌کلیکی WP | `?mode=manual&template=wordpress` |

```powershell
npx playwright test tests/p1-wizard-branches.spec.ts --headed
```

## ماتریس ذهنی قبل از کلیک

| هدف تست | چه چیزی باید سبز باشد |
|---------|------------------------|
| ورود | رقم فارسی موبایل، OTP، بدون ۵۰۰ |
| کیف‌پول | balance خوانا؛ خطای شارژ شفاف |
| ساخت ابری بدون پلن | 4xx واضح نه ۵۰۰ |
| تریال | همه‌جا ۲۴ ساعت (نه ۴۸) |
| لیست پروژه‌ها | هیچ `deploying` ابدی با `deploy_error` سخت |
| آپلود سورس→گیت | zip → `git.hooshgraph.com` |

## توکن تست

از کاربر تست پنل یک Personal Access / Sanctum token بگیر و در `.env.e2e.local`:

```
HG_E2E_TOKEN=...
HG_BASE_URL=https://hooshgraph.com
```

اگر توکن نداری، تست‌های public (بدون auth) را اول بزن.

## ریپوی عمومی

اگر ZIP را روی GitHub عمومی گذاشتی: **هرگز** `.env.e2e.local` را push نکن. فقط `.env.e2e.example`.
