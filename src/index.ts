import { PrismaClient } from "@prisma/client";
import axios from "axios";
import "dotenv/config";
import { AllServersGet, AuthLoginPost } from "./types/craftyapi.js";
import { ActivityType, Client, Collection } from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { SlashCommand } from "./classes/slashcommand.js";
import { TextCommand } from "./classes/textcommand.js";

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

const slashCommands = new Collection<string, SlashCommand>();
const textCommands = new Collection<string, TextCommand>();

const slashCommandDirFiles = readdirSync(
  path.join(import.meta.dirname, "commands", "slash")
);

for (const file of slashCommandDirFiles) {
  try {
    const command = (await import(`./commands/slash/${file}`))
      ?.default as SlashCommand;

    if (command) {
      if (command.data) {
        slashCommands.set(command.data.name, command);
        console.log(`Loaded slash command ${file}`);
        continue;
      }
    }

    console.warn(`Command ${file} is invalid`);
  } catch (error) {
    console.warn(`Failed to load command ${file}: ${error}`);
  }
}

const textCommandDirFiles = readdirSync(
  path.join(import.meta.dirname, "commands", "text")
);

for (const file of textCommandDirFiles) {
  try {
    const command = (await import(`./commands/text/${file}`))
      ?.default as TextCommand;

    if (command) {
      if (command.name) {
        textCommands.set(command.name, command);
        console.log(`Loaded text command ${file}`);
        continue;
      }
    }

    console.warn(`Command ${file} is invalid`);
  } catch (error) {
    console.warn(`Failed to load command ${file}: ${error}`);
  }
}

bot.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  try {
    const dbUser = await $client.discordUser.findFirst({
      where: {
        discordId: message.author.id,
      },
    });

    if (!dbUser) return;
  } catch (error) {
    console.error(error);
    await message.reply("There was an error trying to execute that command!");
  }

  const prefix = process.env.DISCORD_PREFIX || "cs!";

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  const textCommand = textCommands.get(command);

  if (textCommand) {
    try {
      await textCommand.execute({ message, args });
    } catch (error) {
      console.error(error);
      await message.reply("There was an error trying to execute that command!");
    }
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

bot.login(process.env.DISCORD_TOKEN);
