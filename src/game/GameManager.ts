import { Collection, Guild, User, CommandInteraction } from "discord.js";
import { autoReply } from "../util/commandInteraction";
import { Game } from "./Game";

type GuildId = string;
type UserId = string;

export class GameManager {
    /** A Collection of active games. Each member (guild and user) is assigned to one game. */
    private games: Collection<GuildId, Collection<UserId, Game>>;

    constructor() {
        this.games = new Collection();
    }

    /**
     * Creates a new game with the given members.
     * If any of the members are already in a game, replies to the interaction with an error.
     * Otherwise, starts the game immediately.
     */
    async tryNewGame(guild: Guild, players: User[], interaction: CommandInteraction): Promise<void> {
        // Ensure interaction is coming from a guild text channel.
        if (interaction.channel === null || interaction.channel.isDMBased() || !interaction.channel.isTextBased()) {
            await autoReply(interaction, {
                content: "Could not create game: This is not a server text channel.",
            });
            return;
        }
        // Ensure players limit is not exceeded.
        if (players.length > Game.maxPlayers) {
            await autoReply(interaction, {
                content: `Could not create game: Too many players. The maximum is ${Game.maxPlayers}.`,
            })
            return;
        }
        // Ensure players are not in a game already.
        const guildGames: Collection<UserId, Game> = this.games.ensure(guild.id, () => new Collection());
        if (!players.every(user => !guildGames.has(user.id))) {
            await autoReply(interaction, {
                content: "Could not create game: A user is already in a game."
            })
            return;
        }
        // Create new game.
        const now = new Date();
        const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYear = Date.UTC(now.getFullYear(), 0, 0);
        const day = (nowUTC - startOfYear) / 1000 / 60 / 60 / 24;
        const game = new Game(this, guild, players, interaction, interaction.channel, game => this.destroyGame(game), day);
        players.forEach(user => guildGames.set(user.id, game));
        game.run()
            .catch(async error => {
                console.error(error);
                this.destroyGame(game);
                autoReply(game.getInteraction(), {
                    content: "Uh oh, an error occurred during the game.",
                }).catch(errorWhileReplying => {
                    console.error(errorWhileReplying)
                });
            });
    }

    private destroyGame(game: Game): void {
        game.cleanup();
        // Remove all players from the game
        const guildGames: Collection<UserId, Game> = this.games.ensure(game.getGuild().id, () => new Collection());
        game.getPlayers().forEach(user => guildGames.delete(user.id));
    }
}

const gameManager = new GameManager();

export function getGameManager(): GameManager {
    return gameManager;
}
