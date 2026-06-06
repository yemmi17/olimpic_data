FROM nginxinc/nginx-unprivileged:1.27-alpine

LABEL org.opencontainers.image.title="Olympic Data Dashboard"
LABEL org.opencontainers.image.description="Static Olympic dataset dashboard served under /olimpic"

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

COPY site/ /usr/share/nginx/html/olimpic/
COPY outputs/ /usr/share/nginx/html/olimpic/outputs/
COPY data/ /usr/share/nginx/html/olimpic/data/
COPY olympics_analysis.py /usr/share/nginx/html/olimpic/olympics_analysis.py

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/olimpic/ || exit 1
