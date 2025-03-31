import { Prisma } from "@prisma/client";
import { EmbedBuilder } from "discord.js";
import { offlineColor, onlineColor } from "./consts.js";

type currentStatusType = Prisma.StatusGetPayload<{
  select: {
    serverName: true;
    online: true;
    javaIp: true;
    javaPort: true;
    bedrockIp: true;
    bedrockPort: true;
    serverVersion: true;
    playerCounts: {
      select: {
        playerCount: true;
        players: true;
      };
    };
  };
}>;

export const createEmbed = async (
  currentStatus: currentStatusType
): Promise<EmbedBuilder> => {
  // create the embed
  const embed = new EmbedBuilder()
    .setTitle(`${currentStatus.serverName} Status`)
    .setDescription(
      `Server is currently ${
        currentStatus.online ? "**online**" : "**offline**"
      }`
    )
    .setColor(currentStatus.online ? onlineColor : offlineColor)
    .setFooter({
      text: "Last updated",
    })
    .setTimestamp(Date.now());

  if (currentStatus.javaIp) {
    embed.addFields([
      {
        name: "Java IP",
        value: `\`${currentStatus.javaIp}${
          currentStatus.javaPort ? ":" + currentStatus.javaPort : ""
        }\``,
        inline: true,
      },
    ]);
  }
  if (currentStatus.bedrockIp) {
    embed.addFields([
      {
        name: "Bedrock IP",
        value: `\`${currentStatus.bedrockIp}${
          currentStatus.bedrockPort ? ":" + currentStatus.bedrockPort : ""
        }\``,
        inline: true,
      },
    ]);
  }
  embed.addFields([
    {
      name: "Server Version",
      value: `\`${currentStatus.serverVersion}\``,
      inline: true,
    },
  ]);

  // console.log(currentStatus.playerCounts[0].players.replace(/'/g, '"'));

  let playerList: string[] | string = JSON.parse(
    currentStatus.playerCounts[0].players.replace(/'/g, '"')
  ) as string[];
  playerList = playerList.map((player) => player.replace(/"/g, ""));
  // console.log(playerList);

  playerList = playerList.map((player) => player.replace(/^\./g, ""));
  // console.log(playerList);

  playerList = playerList.sort((a, b) => a.localeCompare(b));
  // console.log(playerList);

  playerList = playerList.join("\n");
  // console.log(playerList);

  embed.addFields([
    {
      name: "Online Players",
      value:
        currentStatus.playerCounts[0].playerCount > 0
          ? `${currentStatus.playerCounts[0].playerCount} players online:\n\`\`\`\n${playerList}\n\`\`\``
          : "```\nNo players online\n```",
    },
  ]);

  return embed;
};
