import {
  CommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { CommandArguments, CommandResult } from "../types/command.js";

export class SlashCommand {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (args: SlashCommandArguments) => CommandResult;

  constructor(
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder,
    execute: (args: SlashCommandArguments) => CommandResult
  ) {
    this.data = data;
    this.execute = execute;
  }
}

/**
 * Helper class defining a subcommand for a slash command. Used for organization.
 */
export class SlashSubCommand {
  execute: (args: SlashCommandArguments) => CommandResult;

  constructor(execute: (args: SlashCommandArguments) => CommandResult) {
    this.execute = execute;
  }
}

interface SlashCommandArguments extends CommandArguments {
  interaction: CommandInteraction;
}
