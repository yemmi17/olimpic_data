# Security Notes

## Scope

Проект предназначен для короткосрочной публикации учебного статического дашборда на тестовом стенде.

Сервер отдает:

- HTML/CSS/JS сайта;
- агрегированные данные `site/data.js`;
- исходный CSV `data/athlete_events.csv`;
- Excel-отчет `outputs/olympics_report.xlsx`;
- Python-код анализа `olympics_analysis.py`.

## Проверка секретов

На момент подготовки к деплою явных секретов не найдено:

- токены;
- пароли;
- приватные ключи;
- `.env`;
- kubeconfig;
- cloud credentials.

Проекту не требуются runtime secrets.

## Публичность данных

Исходный CSV и Excel-output намеренно публикуются на сервере.

Операционный риск:

- любой пользователь с доступом к URL сможет скачать CSV и Excel;
- если датасет будет заменен на другой, перед публикацией нужно отдельно проверить наличие персональных, коммерческих или чувствительных данных.

## Frontend security

Сайт статический и не принимает пользовательский ввод.

Особенности:

- нет внешних CDN;
- нет внешних API;
- нет cookies/localStorage/sessionStorage;
- нет форм отправки данных;
- нет авторизации;
- `innerHTML` используется только для локальных заранее сгенерированных данных и отображения локального исходного кода.

Риск XSS считается низким для текущего сценария, но если данные начнут приходить от пользователей или из внешних источников, генерацию HTML нужно заменить на безопасное DOM-построение.

## HTTP security headers

Nginx выставляет:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- `Content-Security-Policy`

Текущий CSP разрешает только локальные ресурсы:

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'none';
frame-ancestors 'none'
```

## Container hardening

Контейнер использует `nginxinc/nginx-unprivileged:1.27-alpine`.

В `docker-compose.yml` включены:

- запуск nginx без root-порта;
- `read_only: true`;
- `no-new-privileges`;
- `cap_drop: ALL`;
- tmpfs для `/tmp`, `/var/cache/nginx`, `/var/run`.

## Known limitations

- Нет встроенной аутентификации. Если стенд не должен быть публичным, ограничь доступ на уровне reverse proxy, firewall, VPN или basic auth.
- Python-код анализа публично доступен, потому что это часть учебной демонстрации.
- CSV весит около 41.5 MB и хранится в git. Для долгоживущего production лучше использовать Git LFS, object storage или отдельный data artifact.

## Security checklist перед деплоем

1. Проверить, что в проекте нет `.env`, ключей и токенов.
2. Проверить, что публикация `data/athlete_events.csv` допустима.
3. Проверить, что внешний reverse proxy отдает HTTPS.
4. Проверить, что `/olimpic/` доступен только нужной аудитории.
5. Проверить headers:

```bash
curl -I https://<host>/olimpic/
```

6. Проверить Docker health:

```bash
docker ps
docker inspect --format='{{json .State.Health}}' olimpic-data
```
