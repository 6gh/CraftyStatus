import { PrismaClient } from "@prisma/client";
import axios from "axios";
import "dotenv/config";
import {
  AllServersGet,
  AuthLoginPost,
  ServerStatusGet,
} from "./types/craftyapi.js";
import {
  ActivityType,
  ChannelType,
  Client,
  ClientEvents,
  Collection,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { SlashCommand } from "./classes/slashcommand.js";
import { TextCommand } from "./classes/textcommand.js";
import { schedule } from "node-cron";
import { createPlayerCountChart } from "./utils/createChart.js";
import { createEmbed } from "./utils/createEmbed.js";
import logger from "./utils/logger.js";
import { BotEvent } from "./classes/botevent.js";
import { statusEmbedActionRow } from "./utils/consts.js";

//ANCHOR - Setup prisma client

export const $client = new PrismaClient({
  // i hate how this looks but it works
  log: (() => {
    switch (process.env.NODE_ENV) {
      case "debug":
        return ["error", "info", "query", "warn"];
      case "development":
        return ["error", "info", "warn"];
      case "production":
      case "silent":
        return ["error", "warn"];

      default:
        return ["error", "warn"];
    }
  })(),
});

//Ensure the discord owner has access to all commands
await $client.discordUser.upsert({
  where: {
    discordId: process.env.DISCORD_OWNER_ID,
  },
  update: {
    creationAllowed: true,
    deleteAllowed: true,
    updateAllowed: true,
  },
  create: {
    discordId: process.env.DISCORD_OWNER_ID,
    creationAllowed: true,
    deleteAllowed: true,
    updateAllowed: true,
  },
});

//ANCHOR - Setup crafty API

if (!process.env.CRAFTY_BASE_URL) {
  throw new Error("CRAFTY_BASE_URL is not defined");
}

if (!process.env.CRAFTY_API_KEY) {
  throw new Error("CRAFTY_API_KEY is not defined");
}

// remove trailing slash
process.env.CRAFTY_BASE_URL = process.env.CRAFTY_BASE_URL.replace(/\/$/, "");

try {
  // try to use the token

  const res = await axios.get(`${process.env.CRAFTY_BASE_URL}/api/v2/servers`, {
    headers: {
      Authorization: `Bearer ${process.env.CRAFTY_API_KEY}`,
    },
  });

  const data = res.data as AllServersGet;

  if (data.status === "ok") {
    logger.info(
      `API Key is working! I have access to ${data.data.length} servers`
    );
  } else {
    throw new Error(
      "CRAFTY_API_KEY is not working to authenticate. Please check the key"
    );
  }
} catch (error) {
  logger.error(error);
  throw new Error(
    "Unknown error occurred while trying to authenticate with CRAFTY_API_KEY"
  );
}

//ANCHOR - Setup discord bot

if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is not defined");
}

if (!process.env.DISCORD_OWNER_ID) {
  throw new Error(
    "DISCORD_OWNER_ID is not defined. Please provide your discord user id"
  );
}

export const bot = new Client({
  intents: ["Guilds", "MessageContent", "GuildMessages"],
  presence: {
    activities: [
      {
        name: "for Minecraft servers",
        type: ActivityType.Watching,
      },
    ],
    status: "online",
  },
});

//ANCHOR - Setup events and commands

export const slashCommands = new Collection<string, SlashCommand>();
export const textCommands = new Collection<string, TextCommand>();
const events = new Collection<string, BotEvent<keyof ClientEvents>>();

// kept getting Warning: Detected unsettled top-level await
// so i wrapped it in an async function
(async () => {
  const slashCommandDirFiles = readdirSync(
    path.join(import.meta.dirname, "commands", "slash")
  );

  for (const file of slashCommandDirFiles) {
    try {
      const { default: command } = await import(`./commands/slash/${file}`);

      if (command instanceof SlashCommand) {
        if (command.data) {
          slashCommands.set(command.data.name, command);
          logger.debug(`Loaded slash command ${file}`);
          continue;
        }
      }

      logger.warn(`Command ${file} is invalid`);
    } catch (error) {
      logger.error(`Failed to load command ${file}: ${error}`);
      continue;
    }
  }

  const textCommandDirFiles = readdirSync(
    path.join(import.meta.dirname, "commands", "text")
  );

  for (const file of textCommandDirFiles) {
    try {
      const { default: command } = await import(`./commands/text/${file}`);

      if (command instanceof TextCommand) {
        if (command.name) {
          textCommands.set(command.name, command);
          logger.debug(`Loaded text command ${file}`);
          continue;
        }
      }

      logger.warn(`Command ${file} is invalid`);
      continue;
    } catch (error) {
      logger.error(`Failed to load command ${file}: ${error}`);
      continue;
    }
  }

  const eventDirFiles = readdirSync(path.join(import.meta.dirname, "events"));

  for (const file of eventDirFiles) {
    try {
      const { default: event } = await import(`./events/${file}`);

      if (event instanceof BotEvent) {
        if (event.on) {
          bot.on(event.on, event.execute);
          logger.debug(`Loaded event ${file}`);
          continue;
        }
      }

      logger.warn(`Event ${file} is invalid`);
      continue;
    } catch (error) {
      logger.error(`Failed to load event ${file}: ${error}`);
      continue;
    }
  }

  logger.info(
    `Loaded commands & events | Slash: ${slashCommands.size} | Text: ${textCommands.size} | Events: ${events.size}`
  );

  //NOTE - We want the bot to load AFTER the commands and events are loaded
  await bot.login(process.env.DISCORD_TOKEN);
})();

//ANCHOR - Status updater: Update the status of the servers every 5 minutes (check every 1 minute)
schedule("*/1 * * * *", async () => {
  logger.debug("[Task] Running status updater");

  const statuses = await $client.status.findMany({
    where: {
      updatedAt: {
        lte:
          process.env.NODE_ENV === "debug" ||
          process.env.NODE_ENV === "development"
            ? new Date(Date.now() - 1000 * 60 * 0.5) // 1000 ms * 60 s * 0.5 = 30 seconds
            : new Date(Date.now() - 1000 * 60 * 5), // 1000 ms * 60 s * 5 = 5 minutes
      },
    },
  });

  logger.debug(`[Task] Found ${statuses.length} statuses to update`);

  for (const status of statuses) {
    try {
      const channel = await bot.channels.fetch(status.channelId);

      if (
        !channel ||
        !channel.isTextBased() ||
        !channel.isSendable() ||
        channel.type !== ChannelType.GuildText
      ) {
        logger.error(
          `Channel ${status.channelId} not found! Will reattempt next time...`
        );
        continue;
      }

      let message = status.messageId
        ? await channel.messages.fetch(status.messageId)
        : (await channel.messages.fetch({ limit: 30 }))
            ?.filter((msg) => msg.author.id === bot.user?.id)
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

      if (message instanceof Collection) {
        logger.warn(
          `[STAT_ID: ${status.id}] Couldn't find the stored message from the database! Attempting to find the newest one in the channel...`
        );

        if (message.size > 1) {
          logger.warn(
            `[STAT_ID: ${status.id}] Found ${message.size} messages by the bot in the channel ${channel.id}. Assuming it is the newest one!`
          );
        }

        const msg = message.first();

        if (!msg) {
          logger.error(
            `[STAT_ID: ${status.id}] No messages by our bot found in the channel ${channel.id}! Will reattempt next time...`
          );
          logger.debug(message);
          continue;
        }

        message = msg;

        logger.warn(
          `[STAT_ID: ${status.id}] Replacing the stored message id with the new one found...`
        );

        await $client.status.update({
          where: {
            id: status.id,
          },
          data: {
            messageId: message.id,
          },
        });
      }

      // now get the server status
      const res = await axios.get(
        `${process.env.CRAFTY_BASE_URL}/api/v2/servers/${status.serverId}/stats`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CRAFTY_API_KEY}`,
          },
        }
      );

      const server = res.data as ServerStatusGet;

      if (server.status !== "ok") {
        logger.error(
          `[STAT_ID: ${status.id}] Server not found, or an error occurred`
        );
        logger.debug(server);
        continue;
      }

      const serverStatus = server.data;

      // create the db entry
      const currentStatus = await $client.status.update({
        where: {
          id: status.id,
        },
        data: {
          serverId: serverStatus.server_id.server_id,
          serverName: serverStatus.server_id.server_name,
          serverVersion: serverStatus.version.replace(/[^0-9\.]/gm, ""),
          maintenance: false,
          online: serverStatus.running,
          playerCounts: {
            create: {
              playerCount: serverStatus.online,
              players: serverStatus.players,
              maxPlayers: serverStatus.max,
            },
          },
          updatedAt: new Date(),
        },
        include: {
          playerCounts: {
            take: 1,
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      // get the last 24-hour player count
      const playerCounts = await $client.playerCount.findMany({
        where: {
          statusId: status.id,
          createdAt: {
            gte: new Date(Date.now() - 1000 * 60 * 60 * 24),
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // create the chart
      const chart = await createPlayerCountChart(
        playerCounts,
        currentStatus.online,
        [
          currentStatus.showMaxPlayers,
          currentStatus.showMaxPlayers
            ? currentStatus.playerCounts[0].maxPlayers
            : -1,
        ]
      );

      const embed = await createEmbed(currentStatus);

      if (chart) {
        embed.setImage(`attachment://player-count-chart.png`);
      }

      message.edit({
        components: [statusEmbedActionRow],
        embeds: [embed],
        files: chart
          ? [{ name: "player-count-chart.png", attachment: chart }]
          : undefined,
      });

      logger.debug(
        `Updated status for https://discord.com/channels/${channel.guildId}/${channel.id}/${message.id}`
      );
    } catch (error) {
      logger.error(error);
    }
  }

  logger.debug("[Task] Status Updater finished");
});
