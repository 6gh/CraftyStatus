import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../../classes/slashcommand.js";

export default new SlashCommand(
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  async ({ interaction }) => {
    await interaction.reply({
      content: "Pong!",
      flags: MessageFlags.Ephemeral,
    });
  }
);
