import type { ClientEvents } from "discord.js";

export class BotEvent<K extends keyof ClientEvents> {
  on: K;
  execute: (...args: ClientEvents[K]) => void | Promise<void>;

  constructor(
    on: K,
    execute: (...args: ClientEvents[K]) => void | Promise<void>
  ) {
    this.on = on;
    this.execute = execute;
  }
}
