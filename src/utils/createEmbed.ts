import { Prisma } from "@prisma/client";
import { EmbedBuilder } from "discord.js";
import { historyColor, offlineColor, onlineColor } from "./consts.js";
import { parseJson } from "./jsonParser.js";
import logger from "./logger.js";

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
  currentStatus: currentStatusType,
  statusDateTaken: Date | null = null
): Promise<EmbedBuilder> => {
  // create the embed
  const embed = new EmbedBuilder()
    .setTitle(`${currentStatus.serverName} Status`)
    .setDescription(
      statusDateTaken
        ? `Showing historic player data for **${statusDateTaken.toDateString()}**`
        : `Server is currently ${
            currentStatus.online ? "**online**" : "**offline**"
          }`
    )
    .setColor(
      statusDateTaken
        ? historyColor
        : currentStatus.online
        ? onlineColor
        : offlineColor
    )
    .setFooter({
      text: statusDateTaken ? statusDateTaken.toDateString() : "Last updated",
    })
    .setTimestamp(statusDateTaken ? null : Date.now());

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

  // logger.debug(currentStatus.playerCounts[0].players.replace(/'/g, '"'));

  let playerList: string[] | string;

  if (statusDateTaken) {
    // get a list of players online at any given time on this day
    let combinedPlayerList: Set<string> = new Set();

    for (let playerCount of currentStatus.playerCounts) {
      const currentPlayerList = parseJson<string[]>(playerCount.players); // "['player1', 'player2', 'player3']" -> ["player1", "player2", "player3"]

      if (!currentPlayerList) {
        logger.debug(
          "[createEmbed;statusDateTaken] Possibly failed to parse player list? currentPlayerList is null"
        );
        logger.debug(playerCount.players);
        continue;
      }

      currentPlayerList.forEach((player) => combinedPlayerList.add(player));
    }

    playerList = Array.from(combinedPlayerList);
  } else {
    const currentPlayerList = parseJson<string[]>(
      currentStatus.playerCounts[0].players
    );

    if (!currentPlayerList) {
      logger.debug(
        "[createEmbed] Possibly failed to parse player list? currentPlayerList is null"
      );
      logger.debug(currentStatus.playerCounts[0].players);
    }

    playerList = currentPlayerList ?? [];
  }

  playerList = playerList.map((player) => player.replace(/"/g, ""));
  // logger.debug(playerList);

  playerList = playerList.map((player) => player.replace(/^\./g, ""));
  // logger.debug(playerList);

  playerList = playerList.sort((a, b) => a.localeCompare(b));
  // logger.debug(playerList);

  embed.addFields([
    {
      name: "Online Players",
      value:
        playerList.length > 0
          ? `${
              statusDateTaken
                ? `All players online on ${statusDateTaken.toDateString()}:`
                : `${currentStatus.playerCounts[0].playerCount} players online:`
            }\n\`\`\`\n${playerList.join("\n")}\n\`\`\``
          : statusDateTaken
          ? "No one ever logged in :sob:"
          : "```\nNo players online\n```",
    },
  ]);

  return embed;
};
