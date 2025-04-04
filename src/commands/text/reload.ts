import { REST, Routes } from "discord.js";
import { TextCommand } from "../../classes/textcommand.js";
import { slashCommands } from "../../index.js";
import logger from "../../utils/logger.js";

export default new TextCommand("reload", async ({ message }) => {
  const clientId = message.client.application.id;
  const guildId = message.guildId;

  if (!guildId) {
    await message.reply("This command can only be used in a server.");
    return;
  }

  const commandData = [];

  for (const [_, command] of slashCommands) {
    commandData.push(command.data.toJSON());
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandData,
    });

    logger.info("Successfully reloaded application (/) commands.");
    await message.reply("Successfully reloaded application (/) commands.");
  } catch (error) {
    logger.error(error);
    await message.reply("There was an error trying to reload the commands");
  }
});
