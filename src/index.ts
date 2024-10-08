import { assert } from "./util/assert";
import { Client, Collection, Events, GatewayIntentBits, InteractionReplyOptions } from "discord.js";
import * as dotenv from "dotenv";
import { Command } from "./commands/commandInterface";
import { PingCommand } from "./commands/ping";
import { autoReply } from "./util/commandInteraction";
import { PlayCommand } from "./commands/play";
import { initWordList } from "./game/wordList/wordList";

// Load environment variables.
dotenv.config();
const botToken: string | undefined = process.env.APP_BOT_TOKEN;
assert(botToken !== undefined, "Bot token missing from .env");

// Create client instance.
const client: Client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

Promise.all([
    // Init resources
    initWordList(),
]).then(() => {
    console.log("Done initializing resources.");

    // Init commands
    const commands: Collection<string, Command> = new Collection();
    [
        new PingCommand(),
        new PlayCommand(),
    ].forEach(cmd => commands.set(cmd.slashCommand.name, cmd));

    // Register events.
    client.once(Events.ClientReady, readyClient => {
        console.log(`Logged in as ${readyClient.user.tag}`);
    });

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) {
            return; // Only consider chat input commands.
        }
        assert(commands.has(interaction.commandName), `Received a command for ${interaction.commandName}, which does not exist`);
        const command = commands.get(interaction.commandName)!;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const msg: InteractionReplyOptions = {
                content: `Uh oh, an error occurred!`,
                ephemeral: true,
            };
            await autoReply(interaction, msg);
        }
    });

    client.login(botToken);
})
