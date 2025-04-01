import { BotEvent } from "../classes/botevent.js";
import { $client, textCommands } from "../index.js";
import logger from "../utils/logger.js";

export default new BotEvent("messageCreate", async (message) => {
  if (message.author.bot) return;

  const dbUser = await $client.discordUser.findFirst({
    where: {
      discordId: message.author.id,
    },
  });

  if (!dbUser) return;

  const prefix = process.env.DISCORD_PREFIX || "cs!";

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  const textCommand = textCommands.get(command);

  if (textCommand) {
    try {
      await textCommand.execute({ message, args, dbUser });
    } catch (error) {
      logger.error(error);
      await message.reply("There was an error trying to execute that command!");
    }
  }
});
