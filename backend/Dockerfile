FROM node:22-alpine AS build
ENV CI=true
RUN npm install -g pnpm@10.12.1

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter backend

COPY backend/ ./backend/
RUN pnpm --filter backend run build

FROM node:22-alpine
ENV CI=true NODE_ENV=production
RUN npm install -g pnpm@10.12.1

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter backend --prod
COPY --from=build /app/backend/dist ./backend/dist

EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "backend/dist/index.js"]
