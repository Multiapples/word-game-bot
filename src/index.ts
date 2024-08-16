import { assert } from "./util/assert";
import { Client, Events, GatewayIntentBits } from "discord.js";
import * as dotenv from "dotenv";

// Load environment variables.
dotenv.config();
const botToken: string | undefined = process.env.APP_BOT_TOKEN;
assert(botToken !== undefined, "Bot token missing from .env");

// Create client instance.
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

// Register events.
client.once(Events.ClientReady, readyClient => {
    console.log(`Logged in as ${readyClient.user.tag}`);
});

client.login(botToken);