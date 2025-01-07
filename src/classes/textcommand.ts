import { Message } from "discord.js";
import { CommandResult } from "../types/command.js";

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

interface TextCommandArguments {
  message: Message;
  args: string[];
}
