import { CommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from "discord.js";

export interface Command {
    readonly slashCommand: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute(interaction: CommandInteraction): Promise<void>;
}