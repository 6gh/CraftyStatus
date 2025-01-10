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
  Client,
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
import { offlineColor, onlineColor } from "./utils/consts.js";

//ANCHOR - Setup crafty API

if (!process.env.CRAFTY_BASE_URL) {
  throw new Error("CRAFTY_BASE_URL is not defined");
}

if (!process.env.CRAFTY_USERNAME) {
  throw new Error("CRAFTY_USERNAME is not defined");
}

if (!process.env.CRAFTY_PASSWORD) {
  throw new Error("CRAFTY_PASSWORD is not defined");
}

export const $client = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["error", "info", "query", "warn"]
      : ["error", "warn"],
});

// remove trailing slash
process.env.CRAFTY_BASE_URL = process.env.CRAFTY_BASE_URL.replace(/\/$/, "");

// try to get a valid token from the database
let needToken = true;

try {
  const token = await $client.apiToken.findFirst({
    where: {
      invalidatedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (token) {
    // try to use the token

    const res = await axios.get(
      `${process.env.CRAFTY_BASE_URL}/api/v2/servers`,
      {
        headers: {
          Authorization: `bearer ${token.token}`,
        },
      }
    );

    const data = res.data as AllServersGet;

    if (data.status === "ok") {
      console.log(
        `Found working token. I have access to ${data.data.length} servers`
      );

      needToken = false;
    } else {
      console.log(`Token is not working:\n${data.status}`);
    }
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}

if (needToken) {
  // try to get a new token

  console.log("Trying to get a new token...");

  try {
    const res = await axios.post(
      `${process.env.CRAFTY_BASE_URL}/api/v2/auth/login`,
      {
        username: process.env.CRAFTY_USERNAME,
        password: process.env.CRAFTY_PASSWORD,
      }
    );

    const data = res.data as AuthLoginPost;

    if (data.status === "ok") {
      console.log("Got a new token. Testing...");
      await $client.apiToken.create({
        data: {
          token: data.data.token,
        },
      });

      const res = await axios.get(
        `${process.env.CRAFTY_BASE_URL}/api/v2/servers`,
        {
          headers: {
            Authorization: `bearer ${data.data.token}`,
          },
        }
      );

      const serversdata = res.data as AllServersGet;

      if (serversdata.status === "ok") {
        console.log(
          `New token is working. I have access to ${serversdata.data.length} servers`
        );
      } else {
        throw new Error(`New token is not working:\n${serversdata.status}`);
      }
    } else {
      throw new Error(`${data.status} is not ok:\n${data.data}`);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
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

bot.on("ready", () => {
  console.log(`Logged in as ${bot.user?.tag}`);

  console.log(
    `Invite with: https://discord.com/oauth2/authorize?client_id=${bot.application?.id}&permissions=536964096&integration_type=0&scope=bot+applications.commands`
  );
});

//ANCHOR - Setup commands
export const slashCommands = new Collection<string, SlashCommand>();
const textCommands = new Collection<string, TextCommand>();

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
          console.log(`Loaded slash command ${file}`);
          continue;
        }
      }

      console.warn(`Command ${file} is invalid`);
    } catch (error) {
      console.warn(`Failed to load command ${file}: ${error}`);
      if (process.env.NODE_ENV === "development") {
        console.error(error);
      }
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
          console.log(`Loaded text command ${file}`);
          continue;
        }
      }

      console.warn(`Command ${file} is invalid`);
      continue;
    } catch (error) {
      console.warn(`Failed to load command ${file}: ${error}`);
      if (process.env.NODE_ENV === "development") {
        console.error(error);
      }
      continue;
    }
  }
})();

bot.on("messageCreate", async (message) => {
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
      console.error(error);
      await message.reply("There was an error trying to execute that command!");
    }
  }
});

bot.on("interactionCreate", async (interaction) => {
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
    console.error(error);
    await interaction.reply(
      "There was an error trying to execute that command!"
    );
  }
});

//ANCHOR - Ensure the discord owner has access to all commands

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

await bot.login(process.env.DISCORD_TOKEN);

schedule("*/1 * * * *", async () => {
  console.log("Running cron job | Checking embed to update");

  const statuses = await $client.status.findMany({
    where: {
      updatedAt: {
        lte: new Date(Date.now() - 1000 * 60 * 0.5), // 5 minutes
      },
    },
  });

  // get api token
  const token = await $client.apiToken.findFirst({
    where: {
      invalidatedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!token) {
    throw new Error("No valid token found");
  }

  for (const status of statuses) {
    try {
      const channel = await bot.channels.fetch(status.channelId);

      if (!channel || !channel.isTextBased() || !channel.isSendable()) {
        console.warn(
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
        const msg = message.first();

        if (message.size > 1) {
          console.warn(
            `Found ${message.size} messages by the bot in the channel ${channel.id}. Assuming it is the newest one!`
          );
        }

        if (!msg) {
          console.warn("No message found! Will reattempt next time...");
          continue;
        }

        message = msg;

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
            Authorization: `bearer ${token.token}`,
          },
        }
      );

      const server = res.data as ServerStatusGet;

      if (server.status !== "ok") {
        console.warn("Server not found, or an error occurred");
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

      // create the embed
      const embed = new EmbedBuilder()
        .setTitle(`${currentStatus.serverName} Status`)
        .setDescription(
          `Server is currently ${currentStatus.online ? "online" : "offline"}`
        )
        .setColor(currentStatus.online ? onlineColor : offlineColor)
        .setFooter({
          text: "Last updated",
        })
        .setTimestamp(Date.now());

      if (currentStatus.serverIp) {
        embed.addFields([
          {
            name: "Server IP",
            value: `\`${currentStatus.serverIp}\``,
            inline: true,
          },
        ]);
      }

      const playerList = (
        JSON.parse(
          currentStatus.playerCounts[0].players.replace(/'/g, '"')
        ) as string[]
      ).join("\n");

      embed.addFields([
        {
          name: "Server Version",
          value: `\`${currentStatus.serverVersion}\``,
          inline: true,
        },
        {
          name: "Player Count",
          value: `\`${currentStatus.playerCounts[0].playerCount} players online\``,
          inline: true,
        },
        {
          name: "Online Players",
          value:
            currentStatus.playerCounts[0].playerCount > 0
              ? `\`\`\`${playerList}\`\`\``
              : "```No players online```",
        },
      ]);

      if (chart) {
        embed.setImage(`attachment://player-count-chart.png`);
      }

      message.edit({
        embeds: [embed],
        files: chart
          ? [{ name: "player-count-chart.png", attachment: chart }]
          : undefined,
      });
    } catch (error) {
      console.error(error);
    }
  }

  console.log("Cron job finished");
});
