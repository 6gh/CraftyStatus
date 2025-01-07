import { TextCommand } from "../../classes/textcommand.js";

export default new TextCommand("ping", async ({ message }) => {
  await message.reply("Pong!");
});
