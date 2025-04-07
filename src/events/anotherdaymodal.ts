import {
  ActionRowBuilder,
  MessageFlags,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { BotEvent } from "../classes/botevent.js";
import { statusEmbedActionRowButtonId } from "../utils/consts.js";
import logger from "../utils/logger.js";
import { $client } from "../index.js";
import { createPlayerCountChart } from "../utils/createChart.js";
import { createEmbed } from "../utils/createEmbed.js";

export default new BotEvent("interactionCreate", async (interaction) => {
  //ANCHOR - If the interaction is the button to show the modal
  if (
    interaction.isButton() &&
    interaction.customId === statusEmbedActionRowButtonId
  ) {
    const modal = new ModalBuilder()
      .setCustomId("anotherDayModal")
      .setTitle("View Another Day")
      .addComponents([
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents([
          new TextInputBuilder()
            .setCustomId("date")
            .setStyle(TextInputStyle.Short)
            .setLabel("Enter the date you want to see a graph for")
            .setPlaceholder("DD/MM/YYYY")
            .setMinLength(8)
            .setMaxLength(10)
            .setRequired(true),
        ]),
      ]);

    await interaction.showModal(modal);
  }

  //ANCHOR - If the interaction is the modal itself
  if (
    interaction.isModalSubmit() &&
    interaction.customId === "anotherDayModal" &&
    interaction.isFromMessage()
  ) {
    const inputDate = interaction.fields.getTextInputValue("date");

    if (!inputDate) {
      logger.warn(
        "No date entered for anotherDayModal, yet the field was required. Possible bug?"
      );
      logger.debug(interaction);
      await interaction.reply({
        content: "You didn't enter a date!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const dateRegex = /([0-9]?[0-9])\/([0-9]?[0-9])\/([0-9][0-9][0-9][0-9])/gm;
    const dateMatch = inputDate.match(dateRegex);

    if (!dateMatch) {
      logger.debug(`Date failed regex; date entered: ${inputDate}`);
      await interaction.reply({
        content: "You didn't enter a valid date!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const [day, month, year] = dateMatch[0].split("/").map((segment) => {
      return parseInt(segment);
    });

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      logger.debug(`Date failed isNaN; date entered: ${inputDate}`);
      await interaction.reply({
        content: "You didn't enter a valid date!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12 ||
      year < 1 ||
      year > 9999
    ) {
      logger.debug(`Date failed constraints; date entered: ${inputDate}`);
      await interaction.reply({
        content: "You didn't enter a valid date!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const date = new Date(year, month - 1, day);

    if (date.toString() === "Invalid Date") {
      logger.debug(
        `Date failed Date object creation; date entered: ${inputDate}`
      );
      await interaction.reply({
        content: "You didn't enter a valid date!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      const status = await $client.status.findUnique({
        where: {
          messageId: interaction.message.id,
        },
        include: {
          playerCounts: {
            where: {
              createdAt: {
                gte: date,
                lt: new Date(date.getTime() + 1000 * 60 * 60 * 24), // Add 24 hours to the date
              },
            },
          },
        },
      });

      if (!status) {
        logger.warn(
          `No status found in the channel ${interaction.channelId}, despite the button being here. Possible bug?`
        );
        logger.debug(interaction);
        await interaction.editReply({
          content: "No status found in this channel!",
        });
        return;
      }

      logger.debug(
        `Checking Status MESSAGE_ID: ${interaction.message.id} | STAT_ID: ${
          status.id
        } |  Date: ${date.toISOString()}`
      );

      if (status.playerCounts.length <= 0) {
        await interaction.editReply({
          content: `No player counts found for ${date.toDateString()}!`,
        });
        return;
      }

      // create the chart
      const chart = await createPlayerCountChart(status.playerCounts, [
        status.showMaxPlayers,
        status.playerCounts.sort((a, b) => b.maxPlayers - a.maxPlayers)[0]
          .maxPlayers,
      ]);

      const embed = await createEmbed(status, date);

      if (chart) {
        embed.setImage(`attachment://player-count-chart.png`);
      }

      await interaction.editReply({
        embeds: [embed],
        files: chart
          ? [{ name: "player-count-chart.png", attachment: chart }]
          : undefined,
      });
    } catch (error) {
      logger.error(error);
      await interaction.editReply({
        content:
          "An error occurred while trying to fetch the data! Please try again later.",
      });
    }
  }
});
