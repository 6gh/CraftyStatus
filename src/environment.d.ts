declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production";
    DISCORD_TOKEN: string;
    DISCORD_OWNER_ID: string;
    DISCORD_PREFIX: string;
    CRAFTY_BASE_URL: string;
    CRAFTY_USERNAME: string;
    CRAFTY_PASSWORD: string;
    DATABASE_URL: string;
  }
}
