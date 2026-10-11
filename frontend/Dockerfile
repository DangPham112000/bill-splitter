FROM node:22-alpine AS build
ENV CI=true
RUN npm install -g pnpm@10.12.1

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
# The shared package builds itself on install (its prepare script), so it is copied in full first.
COPY shared/ ./shared/
RUN pnpm install --frozen-lockfile --filter "frontend..."

COPY frontend/ ./frontend/
RUN pnpm --filter frontend run build

FROM nginx:alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
