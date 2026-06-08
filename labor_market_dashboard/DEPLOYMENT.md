# Production deployment

Streamlit dashboard is deployed as a separate Docker Compose service and does not replace the existing `/olimpic/` static site.

## Data placement on the server

Put the full vacancy dataset into the repository `data` directory:

```text
data/vacancy.csv
```

When Compose starts the dashboard, this directory is mounted read-only:

```text
./data:/app/data:ro
```

Inside the container the application reads:

```text
/app/data/vacancy.csv
```

If `data/vacancy.csv` is missing, the dashboard starts with the bundled sample:

```text
labor_market_dashboard/sample_vacancies.csv
```

Do not commit the full `data/vacancy.csv` file. It is intentionally ignored by git.

## Run with Docker Compose

From the repository root:

```bash
docker compose up -d --build labor-market-dashboard
```

Default external URL:

```text
http://127.0.0.1:8501/
```

To use another host port:

```bash
LABOR_MARKET_HOST_PORT=8510 docker compose up -d --build labor-market-dashboard
```

Healthcheck endpoint:

```text
http://127.0.0.1:8501/_stcore/health
```

Expected response body:

```text
ok
```

## Reverse proxy

For public access, place the Streamlit service behind an external reverse proxy on a separate hostname or path.

Example upstream target:

```text
http://127.0.0.1:8501/
```

Streamlit uses websockets, so a production reverse proxy must pass upgrade headers.

Example nginx location:

```nginx
location /labor-market/ {
    proxy_pass http://127.0.0.1:8501/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

If a path prefix is used, test Streamlit carefully because static assets and websocket paths may need additional proxy rules. A separate subdomain is simpler.

## Operational notes

- The container runs as a non-root user.
- The container filesystem is read-only.
- `/tmp` is writable through tmpfs for Streamlit runtime files.
- `./data` is mounted read-only to avoid accidental dataset modification from the app.
- No secrets are required.
- The full vacancy CSV can be large, so keep it outside git and update it on the server as data.
