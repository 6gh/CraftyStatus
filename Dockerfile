FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
#RUN mkdir -p /opt/craftystatus

# Package -> Required for
# openssl -> sqlite
# fontconfig -> node-canvas
RUN apt-get update -y && apt-get install -y openssl fontconfig
RUN rm -rf /var/lib/apt/lists/*

FROM base
ENV NODE_ENV=production
ENV DISCORD_TOKEN=
ENV DISCORD_OWNER_ID=
ENV DISCORD_PREFIX=cs!
ENV CRAFTY_BASE_URL=
ENV CRAFTY_INSECURE_API=false
ENV CRAFTY_API_KEY=
ENV POSTGRES_URL=
ENV TZ=America/New_York

COPY . /app
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm prisma generate
RUN pnpm run build

# EXPOSE 8000
CMD [ "pnpm", "start" ]
