import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from "discord.js";

export interface Command {
    readonly slashCommand: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}