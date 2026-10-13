# Перенесення на Ubuntu: vs-mnt.vstg.com.ua

Це інструкція; сервер ще не змінено. Потрібні SSH-доступ, DNS цього домену, Docker Compose та Node.js 20+ (рекомендовано 24 LTS). Встановіть Docker за офіційною інструкцією для Ubuntu. Підтвердьте `node --version` і `docker compose version`.

## 1. Код і приватні дані

Клонуйте https://github.com/Floratania/market-site у `/opt/market-site`. Перед клонуванням останні локальні зміни мають бути завантажені в GitHub. В каталозі виконайте `npm install`. Створіть користувача `vsmarket`, надайте йому право читати та змінювати каталог проєкту. Цьому користувачу потрібен доступ до Docker: резервування виконує команди всередині Saleor. Доступ до групи Docker фактично дає адміністративні права на хост.

Перенесіть приватним каналом (SFTP/SCP, не Git):

- PostgreSQL Saleor — через `pg_dump`, разом із власною таблицею резервів.
- `/app/media` з контейнера API — усі фотографії Saleor.
- `integration/orders/` — замовлення та черга повідомлень, без `.notification-worker.lock` і тимчасових файлів.
- `integration/*.local.json` і потрібні локальні маніфести/вивантаження — залишки, доступ до SQL Server, фото, налаштування магазину й повідомлень.
- `public/assets/uploads/` та `integration/product-photos/`, якщо присутні.

Не переносіть Windows `.runtime`, `node_modules`, pgAdmin парольні файли та стару `.env` як готову серверну конфігурацію. Серверну `.env` створіть із `deploy/storefront.env.example`. Перевірте slug каналу у відновленій базі.

Перед фінальним копіюванням призупиніть приймання замовлень та імпорт. Не запускайте дві копії магазину з незалежними базами для одних залишків. Локальні замовлення й PostgreSQL резерви потрібно копіювати узгоджено.

## 2. Saleor

Відновлюйте ту саму версію Saleor 3.23 і PostgreSQL 15. Локальний `docker-compose.yml` — основа для підготовки, а не готова production-конфігурація. Створіть приватні `saleor-platform/common.env` та `backend.env` з прикладів, заповніть всі `CHANGE_ME`.

Обов’язково: `DEBUG=False`, постійні нові `SECRET_KEY` та `RSA_PRIVATE_KEY`, власний пароль PostgreSQL із відповідним `DATABASE_URL`, `ALLOWED_HOSTS` для `vs-mnt.vstg.com.ua,127.0.0.1,localhost,api`, `ALLOWED_CLIENT_HOSTS=vs-mnt.vstg.com.ua`. Налаштуйте SMTP Saleor для реєстрації й відновлення пароля: це окремо від повідомлень про замовлення.

Запускайте потрібні сервіси явно, щоб не запускати pgAdmin з відсутніми Windows файлами:

```bash
cd /opt/market-site/saleor-platform
docker compose -p vsmarket-local up -d db cache jaeger mailpit
# Відновіть dump у порожню saleor, перенесіть media у saleor-media.
docker compose -p vsmarket-local run --rm api python3 manage.py migrate
docker compose -p vsmarket-local up -d api worker dashboard
```

Перед цим змініть стандартний пароль `saleor` у compose і приватній конфігурації. Порти 8000/5432/9000 лишайте доступними тільки через 127.0.0.1. Повна адмінка — через SSH-тунель; проста `/manage` працює через сайт. Mailpit не публікуйте в інтернет.

## 3. Nginx і HTTPS

Після налаштування DNS і встановлення Nginx скопіюйте `deploy/vs-mnt.vstg.com.ua.nginx.conf` у `/etc/nginx/sites-available/vs-mnt.vstg.com.ua`, створіть посилання у `sites-enabled`, виконайте `sudo nginx -t`, потім reload. Увімкніть HTTPS сертифікатом для домену (наприклад Certbot). Не приймайте логіни/замовлення до ввімкнення HTTPS. Якщо TLS уже завершується на зовнішньому proxy, узгодьте його конфігурацію замість другого незалежного TLS.

## 4. Постійний запуск

Перевірте `/usr/bin/node` у service. Власником приватних файлів має бути `vsmarket`; права файлів — 600. Скопіюйте `deploy/vsmarket.service` у `/etc/systemd/system/`:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vsmarket
sudo systemctl status vsmarket
```

Для резервів зберігайте compose за `/opt/market-site/saleor-platform/docker-compose.yml` і project name `vsmarket-local`: цей шлях використовує інтеграція резервування.

## 5. Контроль перед відкриттям

Перевірте фото без localhost URL, вхід/реєстрацію, кошик між двома браузерами, замовлення, резерв та повідомлення. Налаштуйте резервні копії бази, orders, uploads і приватної конфігурації. На Ubuntu немає Windows шляхів до файлового сервера фото — забезпечте доступ до нього або використовуйте перенесені фото. Вмикайте `CATALOG_AUTO_SYNC=1` тільки після перевірки MSSQL із сервера. Нові акаунти й кошик не мають отримувати помилки Origin.

Джерела: https://docs.saleor.io/setup/configuration, https://docs.docker.com/engine/install/ubuntu/, https://ubuntu.com/server/docs/how-to/web-services/configure-nginx/
