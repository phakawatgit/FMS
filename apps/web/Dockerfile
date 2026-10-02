FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY apps/web ./apps/web
COPY Front-end ./apps/web/public/legacy
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
