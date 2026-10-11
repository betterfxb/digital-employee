FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm build
EXPOSE 3001
CMD ["pnpm", "start"]
