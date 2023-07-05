# syntax=docker/dockerfile:1
FROM node:20 AS builder
WORKDIR /build

COPY src .
COPY tsconfig.json .

RUN mkdir -p /public

RUN npm install -g sass
RUN npm install -g typescript
RUN npm install --save-dev @types/jquery

RUN sass main.sass public/index.css --no-source-map -s compressed
RUN tsc -p ./tsconfig.json

FROM python:3.11-slim

WORKDIR /app
COPY public ./public

WORKDIR /app/public
COPY --from=builder /build/public/index.css .
COPY --from=builder /build/public/index.js .

WORKDIR /app
EXPOSE 80
CMD ["python", "-m", "http.server", "-d", "public", "80"]
