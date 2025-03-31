FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

RUN mkdir -p /opt/craftystatus

# Package -> Required for
# openssl -> sqlite
# fontconfig -> node-canvas
RUN apt-get update -y && apt-get install -y openssl fontconfig
RUN rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV DISCORD_TOKEN=
ENV DISCORD_OWNER_ID=
ENV DISCORD_PREFIX=cs!
ENV CRAFTY_BASE_URL=
ENV CRAFTY_USERNAME=
ENV CRAFTY_PASSWORD=
ENV DATABASE_URL="file:/opt/craftystatus/prod.db"

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm prisma db push
RUN pnpm prisma generate
RUN pnpm run build

# EXPOSE 8000
CMD [ "pnpm", "start" ]
