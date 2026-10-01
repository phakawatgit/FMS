FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts
COPY .env.example ./.env.example

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run images:backfill && npm start"]
