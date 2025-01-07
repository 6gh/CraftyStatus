import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandResult } from "../types/command.js";

export class SlashCommand {
  data: SlashCommandBuilder;
  execute: (args: SlashCommandArguments) => CommandResult;

  constructor(
    data: SlashCommandBuilder,
    execute: (args: SlashCommandArguments) => CommandResult
  ) {
    this.data = data;
    this.execute = execute;
  }
}

interface SlashCommandArguments {
  interaction: CommandInteraction;
}
