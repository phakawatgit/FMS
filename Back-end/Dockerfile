# Use the glibc based image so Prisma uses its Debian engine instead of the
# musl engine. The generated query engine is baked into this image at build time.
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY src ./src
COPY .env.example ./.env.example

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && npm start"]
