declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "debug" | "development" | "production" | "silent";
    DISCORD_TOKEN: string;
    DISCORD_OWNER_ID: string;
    DISCORD_PREFIX: string;
    CRAFTY_BASE_URL: string;
    CRAFTY_API_KEY: string;
    POSTGRES_URL: string;
  }
}
