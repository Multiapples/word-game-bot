import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "./commandInterface";

export class PingCommand implements Command {

    slashCommand: SlashCommandBuilder = new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Test latency");

    async execute(interaction: CommandInteraction): Promise<void> {
        const sent: number = interaction.createdTimestamp;
        const received: number = Date.now();
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xffff80)
                    .setDescription(`Received in ${sent - received}`),
            ],
        });
        const returned: number = Date.now();
        interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xffff80)
                    .setDescription(
                        `Received in ${sent - received} ms\n` +
                        `Returned in ${returned - received} ms`
                    ),
            ]
        });
    }
}