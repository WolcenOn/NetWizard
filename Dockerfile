FROM golang:1.22-alpine AS build

WORKDIR /src
COPY go.mod ./
COPY backend ./backend

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /out/netwizard ./backend/cmd/netwizard-server

FROM alpine:3.20

RUN addgroup -S netwizard && adduser -S -G netwizard netwizard

WORKDIR /app
COPY --from=build /out/netwizard /app/netwizard
COPY index.html /app/public/index.html
COPY css /app/public/css
COPY js /app/public/js
COPY i18n /app/public/i18n
COPY samples /app/public/samples
COPY schemas /app/public/schemas
COPY portfolio.json /app/public/portfolio.json

ENV NETWIZARD_STATIC_DIR=/app/public

USER netwizard
EXPOSE 8080

CMD ["/app/netwizard"]
