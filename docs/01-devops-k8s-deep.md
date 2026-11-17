# مستند عمیق DevOps و Kubernetes هوش‌گراف

> مخاطب: کسی که Docker را می‌شناسد ولی با Kubernetes تازه کار است.  
> سطح: کامل و عملی روی معماری واقعی Hooshgraph (نه تئوری عمومی خالی).  
> به‌روز: نوامبر ۲۰۲۶ · ممیزی منابع زنده هم در همین جلسه گرفته شد.

---

## ۰) نقشه ذهنی در یک نگاه

Hooshgraph دو «جهان» جدا دارد که هر دو با **k3s** (Kubernetes سبک) اجرا می‌شوند، ولی روی **دو ماشین فیزیکی جدا**:

| جهان | سرور | IP | کار |
|------|------|-----|-----|
| **پلتفرم محصول** (سایت، API، ادمین، وردپرس بلاگ) | `hooshgraph-rtsrv` | `185.181.180.147` | namespace `hg-production` + لبهٔ عمومی `hg-ingress` |
| **پروژه‌های ابری مشتری (PaaS)** | `hooshgraph-k8s` (DB id **۴۳**، origin) | `185.181.183.64` | هر پروژه یک namespace مثل `hg-{slug}` |

اگر فقط یک جمله یادت بماند:

> **سایت هوش‌گراف روی rtsrv است؛ پروژه‌هایی که مشتری در پنل می‌سازد عمدتاً روی hooshgraph-k8s مستقر می‌شوند.**

این دو کلاستر را در ذهن یکی نکن. هر کدام k3s جدا، API جدا، Node جدا.

---

## ۱) از Docker تا Kubernetes — ترجمهٔ مفاهیم

فرض کن قبلاً این را داشتی:

```bash
docker compose up -d
# سرویس web روی :3000 و api روی :80
```

در Kubernetes همان ایده با نام‌های دیگر است:

| Docker Compose | Kubernetes | معنی ساده |
|----------------|------------|-----------|
| `service` | `Deployment` + `Pod` | چند کپی از یک کانتینر |
| یک container در حال اجرا | `Pod` | کوچک‌ترین واحد اجرا (ممکن است چند کانتینر داشته باشد) |
| `ports:` / publish | `Service` | آدرس پایدار داخل کلاستر |
| reverse proxy مثل nginx/traefik روی هاست | `Ingress` یا nginx جدا | ورود ترافیک از بیرون |
| شبکهٔ compose | `Namespace` | جداسازی منطقی پروژه‌ها |
| `docker image` | image در registry/`ctr` | همان ایمیج؛ k3s با containerd کار می‌کند |
| `docker logs` | `kubectl logs` | لاگ Pod |
| `docker exec` | `kubectl exec` | شل داخل Pod |
| volume bind | `hostPath` / PVC | فایل یا دیسک پایدار |

### k3s چیست؟

Kubernetes کامل خیلی سنگین است (چند کنترل‌پلین، etcd جدا، …).  
**k3s** همان Kubernetes است که برای یک‌نود یا لبه‌ها سبک شده؛ روی هر دو سرور Hooshgraph نصب است (`v1.36.2+k3s1`).

دستورهای روزمره روی سرور:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
kubectl get pods -n hg-production
kubectl -n hg-production logs deploy/backend --tail=100
kubectl -n hg-production exec -it deploy/backend -- php artisan about
```

`kubectl` = CLI کنترل کلاستر. تقریباً همه‌چیز از این می‌گذرد.

---

## ۲) اجزای اصلی Kubernetes که در Hooshgraph می‌بینی

### 2.1 Node
ماشین فیزیکی/مجازی که workload را اجرا می‌کند.  
`rtsrv` یک Node است؛ `srvrayatpoor` (hooshgraph-k8s) یک Node دیگر.

### 2.2 Namespace
پوشهٔ منطقی. مثال‌ها:

- `hg-production` — اپ‌های اصلی محصول روی rtsrv
- `hg-ingress` — nginx لبهٔ عمومی
- `hg-staging` — استیج
- `hg-ghestchin` / `hg-arya` / … — پروژه‌های ابری مشتری روی k8s
- `kube-system` — اجزای خود k3s (شامل Traefik پیش‌فرض)

### 2.3 Pod
یک یا چند کانتینر که با هم زمان‌بندی می‌شوند.  
مثال: `backend-74d85f4667-rmmpp` یک Pod از Deployment به نام `backend` است.

اگر Pod بمیرد، Deployment یکی جدید می‌سازد (self-healing). این برتری بزرگ نسبت به `docker run` دستی است.

### 2.4 Deployment
اعلام می‌کند: «همیشه N کپی از این ایمیج با این تنظیمات داشته باش».  
`kubectl set image deploy/backend ...` یعنی ایمیج Deployment را عوض کن → rollout جدید.

### 2.5 Service
نام DNS پایدار داخل کلاستر، مثلاً:

`backend.hg-production.svc.cluster.local:80`

Ingress/nginx به همین نام‌ها پروکسی می‌کند، نه به IP موقت Pod.

### 2.6 ConfigMap / Secret
تنظیمات و رمزها. روی پلتفرم: Secretی مثل `backend-env` برای env لاراول.

### 2.7 hostPath (خیلی مهم در Hooshgraph)
به‌جای ساختن ایمیج جدید برای هر خط PHP، گاهی فایل از دیسک هاست روی مسیر داخل Pod mount می‌شود.

مثال ذهنی:

```
هاست: /var/www/hooshgraph/backend/app/.../X.php
  ↓ hostPath File
Pod:  /var/www/html/app/.../X.php
```

**خطر:** اگر فقط mount کنی و به git پوش نکنی، ایمیج بعدی فایل قدیمی را برمی‌گرداند. برای همین قانون سخت git flow داریم.

---

## ۳) معماری پلتفرم روی `hooshgraph-rtsrv`

### 3.1 درخت روی دیسک هاست

```
/var/www/hooshgraph/
  backend/           ← آینهٔ سورس PHP
  frontend-site/
  frontend-admin/
  deploy/            ← مانیفست‌ها و اسکریپت‌های سرور
  backups/platform/  ← بکاپ پلتفرم
```

لوکال روی لپ‌تاپ:

```
projects/hooshgraph/_prod_pull/{backend,frontend-site,frontend-admin}
```

### 3.2 Namespace `hg-production` — چه چیزی داخلش است؟

| Deployment | نقش |
|------------|-----|
| `backend` | API لاراول (`api.hooshgraph.com`) |
| `queue` | صف Jobها (چند replica) |
| `scheduler` | `artisan schedule:run` |
| `frontend-site` | Nuxt سایت عمومی |
| `frontend-admin` | Nuxt ادمین |
| `wordpress` | بلاگ زیر `/blog/` |
| `terminal-ws` | وب‌سوکت ترمینال |
| `mysql` | دیتابیس پلتفرم |
| `redis` | کش/صف |

### 3.3 لبهٔ عمومی: `hg-ingress` (نه Traefik)

k3s به‌صورت پیش‌فرض Traefik دارد، ولی **ترافیک عمومی Hooshgraph از Traefik نمی‌آید**.

Deployment `nginx-ingress` در namespace `hg-ingress` با `hostNetwork` روی پورت ۸۰/۴۴۳ گوش می‌دهد و دامنه را این‌طور پخش می‌کند:

| دامنه | مقصد |
|-------|------|
| `hooshgraph.com` | `frontend-site:3000` |
| `hooshgraph.com/blog/` | `wordpress:80` |
| `api.hooshgraph.com` | `backend:80` |
| `admin.hooshgraph.com` | `frontend-admin:3000` |

TLS از Let's Encrypt روی مسیرهایی مثل `/etc/letsencrypt/live/hooshgraph.com/`.

**درس عملی:** اگر سایت داون شد ولی Podهای `hg-production` سبز بودند، اول `hg-ingress` و DiskPressure را چک کن (حادثهٔ مستندشده در `docs/incident-diskpressure-20260922.md`).

### 3.4 چطور فرانت دیپلوی می‌شود؟ (قانون طلایی)

روی سرور **هرگز** `npm install` / `nuxt build` نزن (شبکه/رجیستری گیر می‌کند).

مسیر درست:

1. روی لپ‌تاپ در `_prod_pull/frontend-*` → `npm run build`
2. اسکript: `scripts/deploy_frontend_site_local.py` یا `deploy_frontend_admin_local.py`
3. پک `.output` با SFTP می‌رود سرور
4. Docker نازک فقط `COPY .output`
5. `docker save` → `k3s ctr images import`
6. `kubectl set image` در `hg-production`
7. آینهٔ سورس حیاتی روی `/var/www/hooshgraph/...`

### 3.5 چطور بک‌اند پایدار می‌ماند؟

1. ادیت در `_prod_pull/backend`
2. **اجباری:**  
   `python scripts/hooshgraph_git_persist_push.py --repo backend --files ... --message "..."`
3. بعد دیپلوی/مانت/ایمیج
4. اسموک

ریپوهای GitHub:

- `alisoftir/hooshgraph_backend`
- `alisoftir/hooshgraph_frontend_admin`
- `alisoftir/hooshgraph_frontend_site`

---

## ۴) معماری پروژه‌های ابری روی `hooshgraph-k8s`

### 4.1 فلو از دید کاربر تا کلاستر

```
کاربر در پنل → /panel/cloud/create
  → POST /api/v1/cloud/projects
  → CloudProject (status=pending)
  → ProvisionCloudProjectJob
  → Finalize (git/zip/AI manifest)
  → CloudProjectProvisionService
  → pickServer()  ← ترجیح origin id=43
  → ContainerProvisioningService / KubernetesManager
  → namespace hg-{slug} + Deployment/Service/...
  → Deploy git/zip
  → Health check → status ready
  → اگر غیرتریال: شارژ اول
```

### 4.2 Docker یا Kubernetes؟

قالب‌های ابری جدیدتر به سمت **kubernetes** می‌روند (`k8s-web` و …).  
اگر سرور `container_orchestration` برابر `kubernetes` یا `both` باشد، مسیر K8s فعال است.

هر پروژهٔ مشتری معمولاً یک Namespace جدا (`hg-` + slug) می‌گیرد تا ایزوله باشد.

### 4.3 سرور origin و وایلدکارت دامنه

- Origin پیش‌فرض: سرور id **۴۳** = `hooshgraph-k8s`
- دامنهٔ پایه: چیزی شبیه `*.cloudhg.ir` / تنظیمات `CLOUD_SUBDOMAIN_BASE_DOMAIN`
- نود تست `hooshgraph-k8s-test` از pool پرود خارج است تا مشتری به ۴۰۴ نخورد

### 4.4 تریال

- مدت واقعی بک‌اند: **۲۴ ساعت** (`CloudTrialService::HOURS`)
- پلن: `zamin`
- سرور جدا برای تریال نیست؛ همان pool پرود
- سقف تقریبی: محدودیت CPU/RAM/دیسک سبک

### 4.5 تفاوت با «سرور مشتری» (VPS)

`ownership_type=customer` یعنی سروری که مال خود مشتری است.  
قوانین:

- کشف و لیست کانتینر برای نمایش در پنل: مجاز
- نصب/ساخت کانتینر جدید روی آن بدون تأیید صریح امنیتی: **ممنوع**

پروژه ابری پلتفرم ≠ مدیریت VPS مشتری.

---

## ۵) Git flow — چرا این‌قدر سخت‌گیریم؟

ریشهٔ باگ‌های تکراری «فیچر پرید»:

1. کسی روی Pod/هاست فایل را دستی عوض کرد
2. به `origin/main` پوش نشد
3. دیپلوی بعدی ایمیج تمیز کشید و فیکس قبلی محو شد

لایه‌ها:

| لایه | نقش |
|------|-----|
| `origin/main` | تنها منبع حقیقت پایدار |
| `_prod_pull` | میز کار ادیت/بیلد |
| `/var/www/hooshgraph` | آینهٔ هاست |
| hostPath / kubectl | فقط runtime |

اسکریپت اجباری بعد از تغییر ماندگار:

```bash
python scripts/hooshgraph_git_persist_push.py --repo frontend-admin --files pages/attendance/index.vue --message "why..."
```

---

## ۶) دستورات تشخیصی که باید حفظ کنی

### روی rtsrv (پلتفرم)

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl -n hg-production get pods -o wide
kubectl -n hg-ingress get pods
kubectl top nodes
df -h /
free -h
docker system df
```

### روی hooshgraph-k8s (ابری)

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get ns | grep '^hg-'
kubectl -n hg-NAMEofPROJECT get pods,svc,ingress
kubectl -n hg-NAMEofPROJECT describe pod ...
kubectl -n hg-NAMEofPROJECT logs deploy/app --tail=200
```

### از لپ‌تاپ (workspace)

```bash
python scripts/ssh.py hooshgraph-rtsrv
python scripts/remote.py hooshgraph-k8s -- 'kubectl get nodes'
```

---

## ۷) مقایسه با ذهنیّت Docker Compose

اگر بخواهی «compose ذهنی» برای پلتفرم بنویسی، چیزی شبیه این است (ساده و نادقیق، فقط برای درک):

```yaml
# شبه‌compose برای فهم — واقعیت k8s است
services:
  backend: { image: hooshgraph-backend, replicas: 1 }
  queue: { image: hooshgraph-backend, replicas: 3, command: queue }
  scheduler: { image: hooshgraph-backend, command: schedule }
  frontend-site: { image: hooshgraph-frontend-site }
  frontend-admin: { image: hooshgraph-frontend-admin }
  mysql: {}
  redis: {}
  wordpress: {}
  edge-nginx: { network_mode: host }  # hg-ingress
```

تفاوت‌های واقعی که Compose به تو نمی‌دهد و k8s می‌دهد:

- خودترمیمی Pod
- Namespace برای هر مشتری ابری
- rollout کنترل‌شدهٔ ایمیج
- جداسازی منابع (requests/limits)
- سطح عملیاتی یکسان روی چند نود (آینده)

---

## ۸) حوادث و تله‌های واقعی این پروژه

1. **DiskPressure روی rtsrv** → kubelet Pod لبه را اخراج کرد → کل سایت داون، در حالی که backend سالم بود.
2. **hostPath بدون push** → فیکس فردا با ایمیج جدید می‌پرد.
3. **`--sync-from-host` روی ادمین** → صفحات finance که فقط لوکال بودند پاک شدند.
4. **npm روی سرور** → hang بی‌پایان؛ مسیر ممنوع.
5. **Pending Podهای قدیمی e2e/qa** روی کلاستر ابری — نویز مانیتورینگ؛ باید تمیزکاری دوره‌ای.

---

## ۹) چک‌لیست سلامت منابع (نتیجهٔ ممیزی زنده این جلسه)

### `hooshgraph-rtsrv` (پلتفرم)

| شاخص | مقدار | ارزیابی |
|------|--------|---------|
| CPU | ۱۲ هسته Xeon | کافی |
| RAM | ۲۳Gi · ~۱۸Gi available | خوب |
| Load | ~۰.۲۵–۰.۷۷ | آرام |
| Disk `/` | ۱۹۳G · **۶۲٪** پر (۷۱G آزاد) | قابل قبول؛ زیر نظر |
| Node Ready | بله · بدون DiskPressure/MemoryPressure | خوب |
| kubectl top | CPU ~۳۳٪ · Mem ~۲۲٪ | خوب |
| هشدار | ایمیج‌های Docker زیاد (~۵۳GB) · queue با restart زیاد | نیاز به بهداشت دوره‌ای |
| Pending قدیمی | چند namespace تست/retest | تمیزکاری توصیه‌ای |

### `hooshgraph-k8s` (پروژه‌های ابری)

| شاخص | مقدار | ارزیابی |
|------|--------|---------|
| CPU | ۱۲ هسته | کافی |
| RAM | ۲۳Gi · ~۱۸Gi available | خوب |
| Disk `/` | ۱۹۳G · فقط **۲۲٪** | عالی |
| Node Ready | بله · بدون Pressure | خوب |
| kubectl top | CPU ~۴٪ · Mem ~۲۴٪ | خیلی راحت |
| هشدار | چند Pod Pending قدیمی qa/e2e | تمیزکاری؛ ظرفیت کلی OK |
| Docker | عملاً از مسیر k3s/containerd | طبیعی برای نود k8s |

### `hooshgraph-k8s-test`

در این ممیزی SSH timeout — از pool پرود خارج است؛ برای مشتری حیاتی نیست.

### جمع‌بندی صریح

**برای ساخت پروژه ابری جدید، از نظر ظرفیت CPU/RAM/Disk روی origin (`hooshgraph-k8s`) وضعیت خوب و راحت است.**  
روی rtsrv هم پلتفرم پایدار است؛ فقط دیسک ۶۲٪ و انباشت ایمیج/صف queue را دوره‌ای چک کن تا دوباره به DiskPressure نزدیک نشوی.

---

## ۱۰) مسیر مطالعهٔ بعدی داخل همین سری

1. این فایل را تا آخر بخوان و یک‌بار روی rtsrv و یک‌بار روی k8s دستورات بخش ۶ را خودت بزن.
2. یک پروژه ابری تست بساز و Namespaceش را با `kubectl get ns | grep hg-` پیدا کن؛ Podها را `describe` کن.
3. بعد برو سراغ مستند فاز ۲: دیتابیس / بک‌اند / فرانت (جداگانه منتشر می‌شود).
4. فاز ۳: امنیت سرور و کد.

---

## ۱۱) واژه‌نامهٔ سریع فارسی

| واژه | معنی |
|------|------|
| کلاستر | مجموعهٔ Nodeهایی که kubectl می‌بیند |
| رول‌اوت | تعویض تدریجی Podها با ایمیج/کانفیگ جدید |
| ایمیج | بسته‌ی فایل‌سیستم + باینری کانتینر |
| رجیستری | جایی که ایمیج نگه داشته می‌شود؛ اینجا اغلب import مستقیم با `ctr` |
| لبه (edge) | نقطه‌ای که اینترنت به کلاستر وارد می‌شود (`hg-ingress`) |
| Origin سرور | نود پیش‌فرض استقرار ابری (id 43) |
| Hotpatch | تغییر فایل زنده بدون بیلد کامل — فقط اضطراری + باید push شود |

---

*پایان مستند فاز ۱ — DevOps / K8s. حجم بالا عمدی است؛ برای مطالعهٔ چندجلسه‌ای نوشته شده.*
