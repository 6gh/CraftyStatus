import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageActionRowComponentBuilder,
} from "discord.js";

export const onlineColor = "#57f287";
export const offlineColor = "#ed4245";
export const statusEmbedActionRowButtonId = "showDayPickerModal";
export const statusEmbedActionRow =
  new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(statusEmbedActionRowButtonId)
      .setLabel("View History")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📅"),
  ]);
