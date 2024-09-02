import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export interface Command {
    readonly slashCommand: SlashCommandBuilder;
    execute(interaction: CommandInteraction): Promise<void>;
}