import { MessageFlags } from "discord.js";
import { BotEvent } from "../classes/botevent.js";
import { $client, slashCommands } from "../index.js";
import logger from "../utils/logger.js";

export default new BotEvent("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = slashCommands.get(interaction.commandName);

  if (!command) return;

  const dbUser = await $client.discordUser.findUnique({
    where: {
      discordId: interaction.user.id,
    },
  });

  if (!dbUser) {
    await interaction.reply({
      content: "You are not allowed to use this bot",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await command.execute({ interaction, dbUser });
  } catch (error) {
    logger.error(error);
    await interaction.reply(
      "There was an error trying to execute that command!"
    );
  }
});
