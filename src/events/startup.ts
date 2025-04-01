import { BotEvent } from "../classes/botevent.js";
import logger from "../utils/logger.js";

export default new BotEvent("ready", (client) => {
  logger.info(`Logged in as ${client.user?.tag}`, true);

  logger.info(
    `Invite with: https://discord.com/oauth2/authorize?client_id=${client.application?.id}&permissions=536964096&integration_type=0&scope=bot+applications.commands`,
    true
  );
});
