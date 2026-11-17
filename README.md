# Hooshgraph cloud E2E (Playwright) — اتوماتیک

هر **۶ ساعت** روی همین ویندوز با Task Scheduler اجرا می‌شود و نتیجه به ایمیل می‌رود.

## اتوماسیون

| چیز | مقدار |
|-----|--------|
| Task | `HooshgraphE2ECloud` (هر ۶ ساعت) |
| Runner | `scripts/hooshgraph_e2e_cloud_run.py` |
| آلارم | `rayatiali2@gmail.com` از `noreply@hooshgraph.com` |
| لاگ | `projects/hooshgraph/e2e-cloud/cron-logs/` |

```powershell
# نصب/تمدید کرون ویندوز
python scripts/hooshgraph_e2e_cloud_run.py --install-task

# یک‌بار الان (تست + ایمیل)
python scripts/hooshgraph_e2e_cloud_run.py --run
```

لپ‌تاپ باید روشن/بیدار باشد تا Task اجرا شود. اگر لپ‌تاپ خاموش باشد آن نوبت از دست می‌رود.

## دستی

```powershell
cd projects/hooshgraph/e2e-cloud
npm run test:p0
```

توکن در `.env.e2e.local` (commit نشود).
