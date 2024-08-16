import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export interface Command {
    slashCommand: SlashCommandBuilder;
    execute(interaction: CommandInteraction): Promise<void>;
}