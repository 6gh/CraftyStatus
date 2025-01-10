import { Message } from "discord.js";
import { CommandArguments, CommandResult } from "../types/command.js";

export class TextCommand {
  name: string;
  execute: (args: TextCommandArguments) => CommandResult;

  constructor(
    name: string,
    execute: (args: TextCommandArguments) => CommandResult
  ) {
    this.name = name;
    this.execute = execute;
  }
}

interface TextCommandArguments extends CommandArguments {
  message: Message;
  args: string[];
}
