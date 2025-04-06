import {
  CacheType,
  CommandInteractionOption,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../../classes/slashcommand.js";
import axios from "axios";
import { $client, axiosInstance } from "../../index.js";
import { ServerStatusGet } from "../../types/craftyapi.js";
import { createPlayerCountChart } from "../../utils/createChart.js";
import { createEmbed } from "../../utils/createEmbed.js";
import logger from "../../utils/logger.js";
import { statusEmbedActionRow } from "../../utils/consts.js";
import { parseJson } from "../../utils/jsonParser.js";

export default new SlashCommand(
  new SlashCommandBuilder()
    .setName("crafty")
    .setDescription("Crafty Controller status commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new status embed for a server")
        .addStringOption((option) =>
          option
            .setName("uuid")
            .setDescription("The UUID of the server found in Crafty Controller")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("java-ip")
            .setDescription("If you wish to display a java address.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("bedrock-ip")
            .setDescription(
              "If you wish to display a bedrock address. Add port with <ip>:<port>"
            )
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("show-max-players")
            .setDescription(
              "True: shows max players; False: y-axis shows max from last 24h. Default: false."
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("modify")
        .setDescription("Modify an existing status embed")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message ID of the status embed")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("java-ip")
            .setDescription("If you wish to display a java address.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("bedrock-ip")
            .setDescription(
              "If you wish to display a bedrock address. Add port with <ip>:<port>"
            )
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("show-max-players")
            .setDescription(
              "True: shows max players; False: y-axis shows max from last 24h. Default: false."
            )
            .setRequired(false)
        )
    ),
  async ({ interaction, dbUser }) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command must be run in a guild",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.channel || !interaction.channel.isSendable()) {
      await interaction.reply({
        content: "This command must be run in a sendable channel",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // @ts-ignore
    const subcommand = interaction.options.getSubcommand() as string;

    switch (subcommand) {
      case "create":
        {
          // get the list of servers
          if (!dbUser) {
            await interaction.reply({
              content: "You do not have access to this command",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (!dbUser.creationAllowed) {
            await interaction.reply({
              content: "You do not have permission to create a status embed",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // get the options provided
          const uuid = interaction.options.get("uuid");
          const javaip = interaction.options.get("java-ip", false);
          const bedrockip = interaction.options.get("bedrock-ip", false);
          const showMaxPlayers =
            interaction.options.get("show-max-players", false)?.value === true;

          if (!uuid) {
            await interaction.reply({
              content: "No UUID provided",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
          });

          try {
            const res = await axiosInstance.get(
              `${process.env.CRAFTY_BASE_URL}/api/v2/servers/${uuid.value}/stats`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.CRAFTY_API_KEY}`,
                },
              }
            );

            const server = res.data as ServerStatusGet;

            if (server.status !== "ok") {
              await interaction.editReply({
                content: "Server not found, or an error occurred",
              });
              return;
            }

            const status = server.data;

            // extract data
            const serverName = status.server_id.server_name;
            const serverVersion = status.version.replace(/[^0-9\.]/gm, "");
            const javaIp = javaip?.value?.toString() || undefined;
            const bedrockIp =
              bedrockip?.value?.toString().split(":")[0] || undefined;
            const bedrockPort = bedrockip?.value?.toString().split(":")[1];
            const online = status.running;
            const playerCount = status.online;
            const maxPlayers = status.max;
            const players = status.players;

            // create the chart
            const chart = await createPlayerCountChart(
              [
                {
                  playerCount,
                  createdAt: new Date(),
                  maxPlayers,
                },
              ],
              online,
              [showMaxPlayers, showMaxPlayers ? maxPlayers : -1]
            );

            // create the embed
            const embed = await createEmbed({
              serverName,
              online,
              javaIp: javaIp || null,
              javaPort: null,
              bedrockIp: bedrockIp || null,
              bedrockPort: bedrockPort || null,
              serverVersion,
              playerCounts: [
                {
                  playerCount,
                  players,
                },
              ],
            });

            if (chart) {
              embed.setImage(`attachment://player-count-chart.png`);
            }

            const msg = await interaction.channel.send({
              components: [statusEmbedActionRow],
              embeds: [embed],
              files: chart
                ? [{ name: "player-count-chart.png", attachment: chart }]
                : undefined,
            });

            // create the db entry
            await $client.status.create({
              data: {
                channelId: interaction.channelId,
                messageId: msg.id,
                serverId: status.server_id.server_id,
                serverName,
                serverVersion,
                javaIp,
                bedrockIp,
                bedrockPort,
                maintenance: false,
                online: status.running,
                playerCounts: {
                  create: {
                    playerCount,
                    players,
                    maxPlayers,
                  },
                },
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

            await interaction.editReply({
              content: "Status embed created",
            });
          } catch (error) {
            logger.error(error);
            await interaction.reply({
              content: "Failed to get server",
              flags: MessageFlags.Ephemeral,
            });
          }
        }
        break;

      case "modify": {
        if (!dbUser) {
          await interaction.reply({
            content: "You do not have access to this command",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!dbUser.updateAllowed) {
          await interaction.reply({
            content: "You do not have permission to modify a status embed",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // get the options provided
        const messageId = interaction.options.get("message-id");
        const userProvidedJavaIp = interaction.options.get("java-ip", false);
        const userProvidedBedrockIp = interaction.options.get(
          "bedrock-ip",
          false
        );
        let showMaxPlayers:
          | CommandInteractionOption<CacheType>
          | null
          | boolean = interaction.options.get("show-max-players", false);

        if (!messageId?.value) {
          await interaction.reply({
            content: "No message ID provided",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!userProvidedJavaIp?.value && showMaxPlayers?.value === undefined) {
          await interaction.reply({
            content: "No options provided. Updating not necessary",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral,
        });

        try {
          const dbStatus = await $client.status.findUnique({
            where: {
              messageId: messageId.value.toString(),
            },
            include: {
              playerCounts: {
                where: {
                  createdAt: {
                    gte: new Date(Date.now() - 1000 * 60 * 60 * 24), // last 24h
                  },
                },
              },
            },
          });

          if (!dbStatus) {
            await interaction.editReply({
              content: "Status embed not found",
            });
            return;
          }

          showMaxPlayers = showMaxPlayers?.value
            ? showMaxPlayers.value === true
            : dbStatus.showMaxPlayers;

          // get the server data
          const res = await axiosInstance.get(
            `${process.env.CRAFTY_BASE_URL}/api/v2/servers/${dbStatus.serverId}/stats`,
            {
              headers: {
                Authorization: `Bearer ${process.env.CRAFTY_API_KEY}`,
              },
            }
          );

          const server = res.data as ServerStatusGet;

          if (server.status !== "ok") {
            await interaction.editReply({
              content: "Server not found, or an error occurred",
            });
            return;
          }

          const status = server.data;

          // extract data
          const serverName = status.server_id.server_name;
          const serverVersion = status.version.replace(/[^0-9\.]/gm, "");
          const javaIp =
            userProvidedJavaIp?.value?.toString() || dbStatus.javaIp;
          const bedrockIp =
            userProvidedBedrockIp?.value?.toString().split(":")[0] ||
            dbStatus.bedrockIp;
          const bedrockPort =
            userProvidedBedrockIp?.value?.toString().split(":")[1] ||
            dbStatus.bedrockPort;
          const online = status.running;
          const playerCount = status.online;
          const maxPlayers = status.max;
          const players = status.players;

          // create the chart
          const chart = await createPlayerCountChart(
            [
              ...dbStatus.playerCounts,
              {
                playerCount,
                createdAt: new Date(),
                maxPlayers,
              },
            ],
            online,
            [showMaxPlayers, showMaxPlayers ? maxPlayers : -1]
          );

          // update the embed
          const embed = await createEmbed({
            bedrockIp: bedrockIp || null,
            bedrockPort: bedrockPort || null,
            javaIp: javaIp || null,
            javaPort: null,
            online,
            playerCounts: [
              {
                playerCount,
                players,
              },
            ],
            serverName,
            serverVersion,
          });

          if (chart) {
            embed.setImage(`attachment://player-count-chart.png`);
          }

          const channel = await interaction.client.channels.fetch(
            dbStatus.channelId
          );

          if (!channel || !channel.isSendable()) {
            throw new Error("Channel not found");
          }

          const msg = await channel.messages.fetch(dbStatus.messageId);

          if (!msg) {
            logger.warn("Message not found. Creating new message");
            await interaction.channel.send({
              components: [statusEmbedActionRow],
              embeds: [embed],
              files: chart
                ? [{ name: "player-count-chart.png", attachment: chart }]
                : undefined,
            });
          } else {
            await msg.edit({
              components: [statusEmbedActionRow],
              embeds: [embed],
              files: chart
                ? [{ name: "player-count-chart.png", attachment: chart }]
                : undefined,
            });
          }

          // create the db entry
          await $client.status.update({
            where: {
              messageId: dbStatus.messageId,
            },
            data: {
              serverName,
              serverVersion,
              javaIp,
              bedrockIp,
              bedrockPort,
              maintenance: false,
              online: status.running,
              playerCounts: {
                create: {
                  playerCount,
                  players,
                  maxPlayers,
                },
              },
              showMaxPlayers,
            },
          });

          await interaction.editReply({
            content: msg
              ? "Status embed updated"
              : "Original status embed could not be found. A new status embed was created",
          });
        } catch (error) {
          logger.error(error);
          await interaction.reply({
            content: "Failed to update server",
            flags: MessageFlags.Ephemeral,
          });
        }
        break;
      }

      default: {
        throw new Error("Subcommand not found: " + subcommand);
      }
    }
  }
);
