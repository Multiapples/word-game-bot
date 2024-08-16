import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from "discord.js";
import { PingCommand } from "./commands/ping";
import { assert } from "./util/assert";
import * as dotenv from "dotenv";

dotenv.config();

assert(process.env.APP_BOT_TOKEN !== undefined, "Bot token is missing from .env");
const botToken: string = process.env.APP_BOT_TOKEN;
assert(process.env.APP_ID !== undefined, "App ID is missing from .env");
const clientId: string = process.env.APP_ID;
assert(process.env.DEV_GUILD_IDS !== undefined, "Dev guild IDs is missing from .env");
const devGuildIds: string[] = process.env.DEV_GUILD_IDS.split(" ");

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
    new PingCommand(),
].map(cmd => cmd.slashCommand.toJSON());

const rest: REST = new REST().setToken(botToken);

type RestPutReturn = unknown[];
(async () => {
    try {
        console.log(`Refreshing ${commands.length} command(s): ${commands.map(cmd => cmd.name).join(", ")}\n` +
            `\tfor guild(s): ${devGuildIds.join(", ")}`);

        for (const guildId of devGuildIds) {
            console.log(`Guild: ${guildId}`);
            const data: RestPutReturn = await rest.put(
                /* Use `Routes.applicationCommands(clientId),` to deploy globally*/
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            ) as RestPutReturn;
            console.log(`\tSuccessfully reloaded ${data.length} command(s).`);
        }
        console.log("Finished.");
    } catch (error) {
        console.error(error);
    }
})();