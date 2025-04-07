import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  ChannelType,
  CommandInteractionOption,
  ComponentType,
  Message,
  MessageActionRowComponentBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../../classes/slashcommand.js";
import { $client, axiosInstance } from "../../index.js";
import { ServerStatusGet } from "../../types/craftyapi.js";
import { createPlayerCountChart } from "../../utils/createChart.js";
import { createEmbed } from "../../utils/createEmbed.js";
import logger from "../../utils/logger.js";
import { statusEmbedActionRow } from "../../utils/consts.js";

export default new SlashCommand(
  new SlashCommandBuilder()
    .setName("crafty")
    .setDescription("Crafty Controller status commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription(
          "Create a new status embed for a server in this channel"
        )
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
        .addChannelOption((option) =>
          option
            .setName("move-to")
            .setDescription("Move the status embed to another channel")
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete an existing status embed")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message ID of the status embed")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("purge")
        .setDescription("Completely wipe all data related to a server.")
        .addStringOption((option) =>
          option
            .setName("uuid")
            .setDescription("The UUID of the server found in Crafty Controller")
            .setRequired(true)
        )
        .addStringOption(
          (option) =>
            option
              .setName("confirm")
              .setDescription(
                "Type 'confirm deletion of the data' to confirm the purge"
              )
              .setRequired(false) // make it optional so people have to type it
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
          let showMaxPlayers = interaction.options.get(
            "show-max-players",
            false
          )?.value
            ? interaction.options.get("show-max-players", false)?.value === true
            : false;

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
                  online,
                  playerCount,
                  createdAt: new Date(),
                  maxPlayers,
                },
              ],
              [showMaxPlayers, showMaxPlayers ? maxPlayers : -1]
            );

            // create the embed
            const embed = await createEmbed({
              serverName,
              javaIp: javaIp || null,
              javaPort: null,
              bedrockIp: bedrockIp || null,
              bedrockPort: bedrockPort || null,
              serverVersion,
              playerCounts: [
                {
                  online,
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
            await $client.status.upsert({
              where: {
                serverId: status.server_id.server_id,
              },
              create: {
                serverId: status.server_id.server_id,
                serverName,
                serverVersion,
                javaIp,
                bedrockIp,
                bedrockPort,
                maintenance: false,
                playerCounts: {
                  create: {
                    online: status.running,
                    playerCount,
                    players,
                    maxPlayers,
                  },
                },
                messages: {
                  connectOrCreate: {
                    where: {
                      messageId: msg.id,
                    },
                    create: {
                      messageId: msg.id,
                      channelId: msg.channelId,
                    },
                  },
                },
              },
              update: {
                serverName,
                serverVersion,
                javaIp,
                bedrockIp,
                bedrockPort,
                maintenance: false,
                playerCounts: {
                  create: {
                    online: status.running,
                    playerCount,
                    players,
                    maxPlayers,
                  },
                },
                messages: {
                  connectOrCreate: {
                    where: {
                      messageId: msg.id,
                    },
                    create: {
                      messageId: msg.id,
                      channelId: msg.channelId,
                      showMaxPlayers,
                    },
                  },
                  update: {
                    where: {
                      messageId: msg.id,
                    },
                    data: {
                      messageId: msg.id,
                      channelId: msg.channelId,
                      showMaxPlayers,
                    },
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

      case "modify":
        {
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
          const moveTo = interaction.options.get("move-to", false);
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

          if (
            !userProvidedJavaIp?.value &&
            showMaxPlayers?.value === undefined &&
            moveTo?.value === undefined
          ) {
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
            const dbMessage = await $client.messageEmbed.findUnique({
              where: {
                messageId: messageId.value.toString(),
              },
              include: {
                status: {
                  include: {
                    playerCounts: {
                      where: {
                        createdAt: {
                          gte: new Date(Date.now() - 1000 * 60 * 60 * 24), // last 24h
                        },
                      },
                    },
                  },
                },
              },
            });

            if (!dbMessage || dbMessage.status === null) {
              await interaction.editReply({
                content: "Status embed not found",
              });
              return;
            }

            const dbStatus = dbMessage.status;

            showMaxPlayers = showMaxPlayers?.value
              ? showMaxPlayers.value === true
              : dbMessage.showMaxPlayers;

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
                  online,
                  playerCount,
                  createdAt: new Date(),
                  maxPlayers,
                },
              ],
              [showMaxPlayers, showMaxPlayers ? maxPlayers : -1]
            );

            // update the embed
            const embed = await createEmbed({
              bedrockIp: bedrockIp || null,
              bedrockPort: bedrockPort || null,
              javaIp: javaIp || null,
              javaPort: null,
              playerCounts: [
                {
                  online,
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
              dbMessage.channelId
            );

            if (!channel || !channel.isSendable()) {
              throw new Error("Channel not found");
            }

            let msg = await channel.messages.fetch(dbMessage.messageId);

            if (moveTo?.value) {
              logger.debug(
                `Moving status (STAT_ID: ${dbStatus.serverId}) embed (MSG_ID: ${dbMessage.messageId}) to CHANNEL_ID: ${moveTo.value} (${moveTo.channel?.name})`
              );
              const newChannel = await interaction.client.channels.fetch(
                moveTo.value.toString()
              );

              if (!newChannel || !newChannel.isSendable()) {
                await interaction.editReply({
                  content:
                    "Channel not found. Please make sure I can see it, and I can send messages in it.",
                });
                return;
              }

              let newMsg: Message<false> | Message<true> | null = null;

              try {
                newMsg = await newChannel.send({
                  components: [statusEmbedActionRow],
                  embeds: [embed],
                  files: chart
                    ? [{ name: "player-count-chart.png", attachment: chart }]
                    : undefined,
                });
              } catch (error) {
                logger.error(error);
                await interaction.editReply({
                  content: "Failed to send message in new channel",
                });
                return;
              }

              await msg.delete();
              msg = newMsg;
            } else if (!msg) {
              logger.warn("Message not found. Creating new message");
              const channel =
                (await interaction.client.channels.fetch(
                  dbMessage.channelId
                )) || interaction.channel;

              if (!channel || !channel.isSendable()) {
                throw new Error("Channel not found");
              }

              msg = await channel.send({
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
            await $client.messageEmbed.update({
              where: {
                messageId: dbMessage.messageId,
              },
              data: {
                channelId: msg.channelId,
                messageId: msg.id,
                showMaxPlayers,
                status: {
                  update: {
                    serverName,
                    serverVersion,
                    javaIp,
                    bedrockIp,
                    bedrockPort,
                    maintenance: false,
                    playerCounts: {
                      create: {
                        online: status.running,
                        playerCount,
                        players,
                        maxPlayers,
                      },
                    },
                  },
                },
              },
            });

            await interaction.editReply({
              content:
                msg || moveTo?.value
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
        }
        break;

      case "delete":
        {
          if (!dbUser) {
            await interaction.reply({
              content: "You do not have access to this command",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (!dbUser.deleteAllowed) {
            await interaction.reply({
              content: "You do not have permission to delete a status embed",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // get the options provided
          const messageId = interaction.options.get("message-id");

          if (!messageId?.value) {
            await interaction.reply({
              content: "No message ID provided",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const dbMessage = await $client.messageEmbed.findUnique({
            where: {
              messageId: messageId.value.toString(),
            },
          });

          if (!dbMessage) {
            await interaction.reply({
              content: "Status embed not found",
              components: [],
            });
            return;
          }

          // delete the message
          const channel = await interaction.client.channels.fetch(
            dbMessage.channelId
          );
          if (!channel || !channel.isSendable()) {
            throw new Error("Channel not found");
          }

          const msg = await channel.messages.fetch(dbMessage.messageId);
          if (!msg) {
            await interaction.reply({
              content: "Status embed not found",
            });
            return;
          }

          await msg.delete();

          // delete from the database
          await $client.messageEmbed.delete({
            where: {
              messageId: dbMessage.messageId,
            },
          });

          await interaction.reply({
            content: "Status embed deleted",
            flags: MessageFlags.Ephemeral,
          });
        }
        break;

      case "purge":
        {
          if (!dbUser) {
            await interaction.reply({
              content: "You do not have access to this command",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (!dbUser.purgeAllowed) {
            await interaction.reply({
              content: "You do not have permission to purge a status embed",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const uuid = interaction.options.get("uuid")?.value?.toString();
          const confirm = interaction.options.get("confirm")?.value?.toString();

          if (!uuid) {
            await interaction.reply({
              content: "No UUID provided",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const dbStatus = await $client.status.findUnique({
            where: {
              serverId: uuid,
            },
            include: {
              messages: true,
            },
          });

          if (!dbStatus) {
            await interaction.reply({
              content: "Status not found",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (confirm !== "confirm deletion of the data") {
            // doing this just to make it look better
            const confirmMsgArray = [];
            confirmMsgArray.push("# :warning: WARNING :warning:");
            confirmMsgArray.push(
              `This will completely **remove all data related to __${dbStatus.serverName}__ PERMANENTLY from this bot _(not Crafty Controller)_**!!`
            );
            confirmMsgArray.push(
              "This means that the collected player counts will be lost, all messages showing this server status will be deleted, and this data will become **irrecoverable**."
            );
            confirmMsgArray.push("");
            confirmMsgArray.push(
              "If you meant to only delete one message, use `/crafty delete` instead!!"
            );
            confirmMsgArray.push("");
            confirmMsgArray.push(
              "**To continue, rerun this command with the parameter `confirm` set to `confirm deletion of the data`.**"
            );

            await interaction.reply({
              content: confirmMsgArray.join("\n"),
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // delete the messages
          const messages = dbStatus.messages;

          if (messages.length > 0) {
            for (const message of messages) {
              const channel = await interaction.client.channels.fetch(
                message.channelId
              );
              if (!channel || !channel.isSendable()) {
                throw new Error("Channel not found");
              }

              const msg = await channel.messages.fetch(message.messageId);
              if (!msg || !msg.deletable) {
                continue;
              }

              try {
                await msg.delete();
              } catch (error) {
                logger.error(
                  `(STAT_ID: ${dbStatus.serverId}) Failed to delete message ${msg.id} in channel ${channel.id}`
                );
                logger.error(error);
                continue;
              }
            }
          }

          // delete the status
          await $client.status.delete({
            where: {
              serverId: uuid,
            },
          });

          await interaction.reply({
            content: `Status for server ${dbStatus.serverName} purged`,
            flags: MessageFlags.Ephemeral,
          });
        }
        break;

      default: {
        throw new Error("Subcommand not found: " + subcommand);
      }
    }
  }
);
