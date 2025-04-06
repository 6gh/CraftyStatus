declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "debug" | "development" | "production" | "silent";
    DISCORD_TOKEN: string;
    DISCORD_OWNER_ID: string;
    DISCORD_PREFIX: string;
    CRAFTY_BASE_URL: string;
    CRAFTY_INSECURE_API: "false" | "true";
    CRAFTY_API_KEY: string;
    POSTGRES_URL: string;
  }
}
