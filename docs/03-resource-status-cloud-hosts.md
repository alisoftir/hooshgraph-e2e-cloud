# وضعیت منابع سرورهای مرتبط با پروژه ابری و پلتفرم

تاریخ ممیزی زنده: **۱۷ نوامبر ۲۰۲۶**  
اسکریپت: `scripts/_audit_cloud_host_resources.py`  
لاگ خام: `projects/hooshgraph/reports/resource-audit-*.txt`

---

## خلاصهٔ یک‌خطی

**بله — برای ساخت پروژه ابری روی origin (`hooshgraph-k8s`) منابع از نظر CPU، RAM و Disk در وضعیت خوب و راحت است.**  
پلتفرم روی `rtsrv` هم پایدار و بدون Pressure است؛ فقط دیسک ۶۲٪ و انباشت ایمیج/صف را زیر نظر نگه دار.

---

## ۱) `hooshgraph-k8s` — جایی که پروژه ابری ساخته می‌شود (origin id=۴۳)

| شاخص | مقدار | حکم |
|------|--------|-----|
| Hostname | `srvrayatpoor` | — |
| Uptime | ~۴۷ روز | پایدار |
| CPU | ۱۲× Xeon Gold 6138 | کافی |
| Load | ۰.۳–۱.۰ | آرام |
| RAM | ۲۳Gi · available ~۱۸Gi | عالی |
| Disk `/` | ۱۹۳G · **۲۲٪** استفاده · ۱۴۴G آزاد | عالی |
| k3s | Ready · v1.36.2+k3s1 | OK |
| Pressure | Memory/Disk/PID = False | OK |
| kubectl top | CPU ~۴٪ · Mem ~۲۴٪ | خیلی راحت |
| Pending نویز | چند Pod قدیمی `hg-qa-*` | تمیزکاری توصیه‌ای؛ مانع ظرفیت کلی نیست |

**نتیجه:** از نظر ظرفیت سخت‌افزاری برای ساخت پروژه‌های ابری جدید **سبز**.

---

## ۲) `hooshgraph-rtsrv` — پلتفرم (سایت/API/ادمین)

| شاخص | مقدار | حکم |
|------|--------|-----|
| CPU | ۱۲× Xeon Gold 6258R | قوی |
| RAM | ۲۳Gi · available ~۱۸Gi | خوب |
| Load | ۰.۲۵–۰.۷۷ | آرام |
| Disk `/` | ۱۹۳G · **۶۲٪** · ۷۱G آزاد | زرد ملایم — پایش کن |
| Node Ready | بله · بدون Pressure | OK |
| kubectl top | CPU ~۳۳٪ · Mem ~۲۲٪ | OK |
| Docker images | ~۳۳۳ ایمیج / ~۵۳GB | بهداشت دوره‌ای |
| queue pods | restart count بالا (~۶۸) | بررسی لاگ صف |
| Pending قدیمی | چند namespace retest/e2e روی همین نود | تمیزکاری |

**نتیجه:** پلتفرم سالم است. خطر اصلی تاریخی = پر شدن دیسک و اخراج `hg-ingress`. قبل از اینکه Use% به ۸۵٪+ برسد، ایمیج‌های قدیمی و tarهای `/tmp` را پاک کن (با احتیاط؛ prune کور ممنوع طبق حادثهٔ DiskPressure).

---

## ۳) `hooshgraph-k8s-test`

در این ممیزی SSH پاسخ نداد (timeout). این نود از pool پرود خارج است و برای `*.cloudhg.ir` مشتری استفاده نمی‌شود.

---

## ۴) کارهای پیشنهادی (غیرمسدودکننده)

1. روی k8s: حذف/جمع‌کردن namespaceهای `hg-qa-*` و e2e مرده با Pod Pending.  
2. روی rtsrv: کاهش ایمیج‌های بلااستفاده Docker + بررسی علت restartهای `queue`.  
3. آلارم دیسک rtsrv روی آستانهٔ ۷۵٪ و ۸۵٪.

هیچ‌کدام الان مانع «ساخت پروژه ابری جدید» نیستند.
