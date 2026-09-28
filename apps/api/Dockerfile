FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/database/package.json ./packages/database/package.json
RUN npm install
COPY packages/database ./packages/database
COPY apps/api ./apps/api
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["npm", "run", "dev"]
