FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

RUN npm init -y \
    && npm install --omit=dev --save-exact express@4.21.2

COPY serve.cjs ./serve.cjs
COPY --from=build /app/dist/sakai-ng/browser ./public

EXPOSE 8080

CMD ["node", "serve.cjs"]