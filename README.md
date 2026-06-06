# Olympic Data Dashboard

Статический дашборд по датасету `athlete_events.csv` с ответами на учебное задание по анализу данных Олимпийских игр до 2016 года включительно.

Основной production URL внутри контейнера:

```text
/olimpic/
```

При публикации через внешний reverse proxy итоговая ссылка должна выглядеть так:

```text
https://<host>/olimpic/
```

## Состав проекта

```text
.
├── data/
│   └── athlete_events.csv          # исходный CSV
├── outputs/
│   └── olympics_report.xlsx        # Excel-отчет с таблицами и диаграммами
├── site/
│   ├── index.html                  # статический сайт
│   ├── app.js                      # визуализация и UI-логика
│   ├── data.js                     # агрегированные данные для сайта
│   ├── styles.css                  # стили
│   └── assets/
│       └── olympic-rings.svg
├── deploy/
│   └── nginx/
│       └── default.conf            # nginx-конфигурация для /olimpic/
├── olympics_analysis.py            # генератор отчета и site/data.js
├── Dockerfile
├── docker-compose.yml
├── SECURITY.md
└── AGENTS.md
```

## Что отдается сервером

В Docker-образ копируются:

- сайт: `/olimpic/`
- исходный CSV: `/olimpic/data/athlete_events.csv`
- Excel-отчет: `/olimpic/outputs/olympics_report.xlsx`
- код анализа: `/olimpic/olympics_analysis.py`

Код анализа доступен через UI в блоке `Код анализа`, потому что это часть учебной демонстрации.

## Локальная пересборка данных

Скрипт использует локальный CSV по умолчанию:

```text
data/athlete_events.csv
```

Запуск:

```powershell
python olympics_analysis.py
```

Если нужен другой CSV:

```powershell
python olympics_analysis.py --csv path/to/athlete_events.csv
```

Результат:

- обновится `outputs/olympics_report.xlsx`
- обновится `site/data.js`

## Локальный запуск без Docker

Из корня проекта:

```powershell
python -m http.server 8000
```

Локальный dev URL:

```text
http://127.0.0.1:8000/site/
```

Production-like URL `/olimpic/` проверяется через Docker.

## Docker build

```bash
docker build -t olimpic-data:latest .
```

## Docker run

Контейнер слушает порт `8080` внутри контейнера:

```bash
docker run --rm -p 8088:8080 --name olimpic-data olimpic-data:latest
```

Открыть:

```text
http://127.0.0.1:8088/olimpic/
```

## Docker Compose

По умолчанию наружный порт `8088`:

```bash
docker compose up -d --build
```

Открыть:

```text
http://127.0.0.1:8088/olimpic/
```

Изменить порт:

```bash
OLIMPIC_HOST_PORT=8091 docker compose up -d --build
```

## Reverse proxy пример

Если внешний nginx/traefik/caddy принимает HTTPS на `https://xxx`, прокинь путь `/olimpic/` на порт контейнера.

Пример nginx upstream:

```nginx
location /olimpic/ {
    proxy_pass http://127.0.0.1:8088/olimpic/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Healthcheck

Docker healthcheck проверяет:

```text
http://127.0.0.1:8080/olimpic/
```

Ручная проверка:

```bash
curl -I http://127.0.0.1:8088/olimpic/
```

Ожидаемо:

- `200 OK` для `/olimpic/`
- security headers присутствуют
- сайт открывается без внешних CDN/API

## Обновление данных

1. Замени `data/athlete_events.csv`.
2. Запусти:

```bash
python olympics_analysis.py
```

3. Проверь изменения в:

```text
outputs/olympics_report.xlsx
site/data.js
```

4. Пересобери Docker image:

```bash
docker compose up -d --build
```

## Rollback

Для отката на предыдущую версию:

```bash
git checkout <previous-commit>
docker compose up -d --build
```

Если используется image registry, откат выполняется запуском предыдущего тега image.

## Production notes

- Контейнер отдает только статические файлы.
- В контейнере используется unprivileged nginx на порту `8080`.
- В `docker-compose.yml` включены:
  - `read_only: true`
  - `no-new-privileges`
  - `cap_drop: ALL`
  - tmpfs для временных директорий nginx
- Секреты проекту не нужны.
- CSV и Excel-отчет публикуются намеренно.
