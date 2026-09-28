FROM node:24-alpine AS frontend

WORKDIR /src
COPY index.html portfolio.json ./
COPY css ./css
COPY js ./js
COPY private ./private
COPY i18n ./i18n
COPY samples ./samples
COPY schemas ./schemas
COPY scripts/prepare-production-index.js ./scripts/prepare-production-index.js

RUN mkdir -p /out/public/js /out/private \
    && cp index.html portfolio.json /out/public/ \
    && cp -R css i18n samples schemas /out/public/ \
    && npx --yes esbuild@0.25.10 js/*.js --outdir=/out/public/js --minify --target=es2020 \
    && npx --yes esbuild@0.25.10 private/routing-worker.js --bundle --platform=node --target=node24 --format=cjs --minify --outfile=/out/private/routing-worker.cjs \
    && node scripts/prepare-production-index.js /out/public/index.html \
    && rm -f \
       /out/public/js/netwizard-routing-plan.js \
       /out/public/js/netwizard-cisco-routing-generator.js \
       /out/public/js/netwizard-multivendor-routing-generator.js \
       /out/public/js/netwizard-cisco-routing-integration.js \
       /out/public/js/netwizard-multivendor-routing-integration.js \
    && ! grep -q 'netwizard-routing-plan.js\|netwizard-cisco-routing-generator.js\|netwizard-multivendor-routing-generator.js\|netwizard-cisco-routing-integration.js\|netwizard-multivendor-routing-integration.js' /out/public/index.html \
    && test ! -e /out/public/js/netwizard-routing-plan.js \
    && test ! -e /out/public/js/netwizard-cisco-routing-generator.js \
    && test ! -e /out/public/js/netwizard-multivendor-routing-generator.js \
    && test ! -e /out/public/js/netwizard-cisco-routing-integration.js \
    && test ! -e /out/public/js/netwizard-multivendor-routing-integration.js \
    && ! find /out/public -type f \( -name '*.map' -o -name '*.ts' \) | grep -q . \
    && test ! -e /out/public/private \
    && test -s /out/private/routing-worker.cjs

FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
COPY backend ./backend

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /out/netwizard ./backend/cmd/netwizard-server

FROM node:24-alpine

RUN addgroup -S netwizard && adduser -S -G netwizard netwizard

WORKDIR /app
COPY --from=build /out/netwizard /app/netwizard
COPY --from=frontend /out/public/ /app/public/
COPY --from=frontend /out/private/ /app/private/

ENV NETWIZARD_STATIC_DIR=/app/public
ENV NETWIZARD_PRIVATE_ROUTING_WORKER=/app/private/routing-worker.cjs

USER netwizard
EXPOSE 8080

CMD ["/app/netwizard"]
