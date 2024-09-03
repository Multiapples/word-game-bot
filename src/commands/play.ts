import { SlashCommandBuilder, User, Guild, ChatInputCommandInteraction } from "discord.js";
import { Command } from "./commandInterface";
import { getGameManager } from "../game/GameManager";
import { Game } from "../game/Game";

export class PlayCommand implements Command {

    slashCommand = (() => {
        const slashCommand = new SlashCommandBuilder()
            .setName("play")
            .setDescription("Starts a game");
        // Having a bunch of userOptions to invite other players is very unelegant
        // but it's the easiest way to get it working.
        for (let player = 2; player <= Game.maxPlayers; player++) {
            slashCommand.addUserOption(option => option
                .setName(`player${player}`)
                .setDescription("Play with another user"));
        }
        return slashCommand;
    })();

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
        for (let player = 2; player <= Game.maxPlayers; player++) {
            const user: User | null = interaction.options.getUser(`player${player}`, false);
            if (user === null) {
                continue;
            }
            if (players.includes(user)) {
                await interaction.reply({
                    content: "You included yourself or the same player twice.",
                    ephemeral: true,
                });
                return;
            }
            players.push(user);
        }
        await getGameManager().tryNewGame(guild, players, interaction);
    }
}