import { TextCommand } from "../../classes/textcommand.js";
import { $client } from "../../index.js";

export default new TextCommand("myperms", async ({ message }) => {
  try {
    const dbUser = await $client.discordUser.findUnique({
      where: {
        discordId: message.author.id,
      },
    });

    if (!dbUser) return;

    message.reply(
      `You have the following permissions:\ncreationAllowed: ${dbUser.creationAllowed}\nupdateAllowed: ${dbUser.updateAllowed}\ndeleteAllowed: ${dbUser.deleteAllowed}`
    );
  } catch (error) {
    throw error;
  }
});
