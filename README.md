# lapka.manka

Панель для выдачи тестовых профилей IKEv2. Один аккаунт подходит для профилей iOS, Android, Windows и macOS. Панель поддерживает поиск, продление и отзыв. Получателю профиля достаточно ссылки.

Приложение на Go включает HTML, CSS и JavaScript в исполняемый файл, а учётные записи хранит в SQLite. Первый запуск создаёт пустую базу. Ссылки старой версии в Sites относятся к другому хранилищу. Текущая сборка выдаёт образцы с адресом `vpn.example.invalid`. Управление настоящими EAP-учётными данными strongSwan остаётся отдельным этапом.

## Локальный запуск

Нужен Go 1.23 или новее. Укажите пароль администратора в переменной окружения. Пример для Bash:

```bash
read -rsp 'Пароль администратора: ' MAN_KA_ADMIN_PASSWORD
echo
export MAN_KA_ADMIN_PASSWORD
go run .
```

Откройте <http://127.0.0.1:8080>. В окне входа используйте имя `admin` и пароль, который только что ввели. Создайте запись и откройте ссылку в другом браузере или в приватном окне.

## Развёртывание на Ubuntu

Команды ниже рассчитаны на отдельный виртуальный хост Nginx для `lapka.man-ka.ru` и IPv4-запись, указывающую на VPS. Конфигурация приложения в [deploy/man-ka.service](deploy/man-ka.service) слушает только `127.0.0.1:8080`. Проверьте, что этот локальный порт свободен.

1. Соберите приложение и установите бинарный файл.

   ```bash
   CGO_ENABLED=0 go build -trimpath -o man-ka .
   sudo install -m 0755 man-ka /usr/local/bin/man-ka
   ```

2. Создайте пароль для панели. Следующая команда создаёт новый файл при отсутствии предыдущего. Пароль выводится отдельно, чтобы его можно было сохранить в менеджере паролей.

   ```bash
   sudo install -d -m 0700 /etc/man-ka
   sudo sh -c 'umask 077; set -C; openssl rand -hex 24 > /etc/man-ka/admin-password'
   sudo cat /etc/man-ka/admin-password
   sudo install -m 0644 deploy/man-ka.service /etc/systemd/system/man-ka.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now man-ka
   curl -fsS http://127.0.0.1:8080/p/ > /dev/null
   ```

3. Получите TLS-сертификат для поддомена. Если сертификат уже настроен, проверьте его имя и пути в Nginx. Для выпуска нового через HTTP-01 порт 80 должен быть доступен извне. На время выпуска настройте следующий виртуальный хост и включите его по правилам вашей установки Nginx. Если отдельный блок для поддомена уже существует, добавьте в него только обработчик проверки ACME.

   ```nginx
   server {
       listen 80;
       server_name lapka.man-ka.ru;

       location /.well-known/acme-challenge/ {
           root /var/www/man-ka-acme;
       }

       location / {
           return 404;
       }
   }
   ```

   Проверьте, что в Nginx есть только один блок с этим именем на 80, и выполните:

   ```bash
   sudo install -d -m 0755 /var/www/man-ka-acme
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot certonly --webroot -w /var/www/man-ka-acme -d lapka.man-ka.ru
   ```

   Если HTTP извне недоступен, выпуск через DNS-01 возможен отдельно. Для доступа к профилям извне всё равно понадобится доступный HTTPS на 443.

4. Замените временную конфигурацию поддомена на [deploy/lapka.man-ka.ru.conf](deploy/lapka.man-ka.ru.conf). При другой схеме сертификатов подставьте действующие пути. Для стандартной конфигурации Ubuntu:

   ```bash
   sudo install -m 0644 deploy/lapka.man-ka.ru.conf /etc/nginx/sites-available/lapka.man-ka.ru
   sudo ln -sfn /etc/nginx/sites-available/lapka.man-ka.ru /etc/nginx/sites-enabled/lapka.man-ka.ru
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. Откройте <https://lapka.man-ka.ru> и войдите как `admin`. Создайте тестовую запись, откройте ссылку на профили в приватном окне, отзовите доступ и обновите страницу с профилем.

SQLite-файл находится в `/var/lib/man-ka/man-ka.db`. Для резервной копии используйте команду SQLite `.backup` с правами чтения базы. Ссылку на профиль считайте данными для доступа и передавайте только получателю.

Дополнительные параметры задаются переменными `MAN_KA_LISTEN`, `MAN_KA_ORIGIN`, `MAN_KA_ADMIN_USER` и `MAN_KA_DB`. При смене внешнего домена обновите `MAN_KA_ORIGIN`, имя виртуального хоста и сертификат.
