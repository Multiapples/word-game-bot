import { SlashCommandBuilder, User, Guild, ChatInputCommandInteraction } from "discord.js";
import { Command } from "./commandInterface";
import { getGameManager } from "../game/GameManager";

export class PlayCommand implements Command {

    slashCommand = new SlashCommandBuilder()
        .setName("play")
        .setDescription("Starts a game");

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.guild === null) {
            await interaction.reply({
                content: "This command can only be used in a server.",
                ephemeral: true,
            });
            return;
        }
        const guild: Guild = interaction.guild;
        const players: User[] = [interaction.user];
        await getGameManager().tryNewGame(guild, players, interaction);
    }
}