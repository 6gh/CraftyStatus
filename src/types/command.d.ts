import { DiscordUser } from "@prisma/client";

export interface CommandArguments {
  dbUser?: DiscordUser;
}
export type CommandResult = Promise<void> | void;
