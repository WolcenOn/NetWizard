FROM node:24-alpine AS frontend

WORKDIR /src
COPY index.html portfolio.json ./
COPY css ./css
COPY js ./js
COPY i18n ./i18n
COPY samples ./samples
COPY schemas ./schemas

RUN mkdir -p /out/js \
    && cp index.html portfolio.json /out/ \
    && cp -R css i18n samples schemas /out/ \
    && npx --yes esbuild@0.25.10 js/*.js --outdir=/out/js --minify --target=es2020 \
    && test "$(find /out/js -type f -name '*.js' | wc -l)" -eq "$(find js -type f -name '*.js' | wc -l)" \
    && ! find /out -type f \( -name '*.map' -o -name '*.ts' \) | grep -q .

FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
COPY backend ./backend

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /out/netwizard ./backend/cmd/netwizard-server

FROM alpine:3.20

RUN addgroup -S netwizard && adduser -S -G netwizard netwizard

WORKDIR /app
COPY --from=build /out/netwizard /app/netwizard
COPY --from=frontend /out/ /app/public/

ENV NETWIZARD_STATIC_DIR=/app/public

USER netwizard
EXPOSE 8080

CMD ["/app/netwizard"]
