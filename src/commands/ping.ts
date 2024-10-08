import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "./commandInterface";

export class PingCommand implements Command {

    slashCommand = new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Test latency");

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sent: number = interaction.createdTimestamp;
        const reply = await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xffff80)
                    .setDescription(
                        `Websocket heartbeat: ${interaction.client.ws.ping} ms\n` +
                        `Command roundtrip: ... ms`
                    ),
            ],
            fetchReply: true,
        });
        const returned: number = reply.createdTimestamp;
        interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xffff80)
                    .setDescription(
                        `Websocket heartbeat: ${interaction.client.ws.ping} ms\n` +
                        `Command roundtrip: ${returned - sent} ms`
                    ),
            ]
        });
    }
}