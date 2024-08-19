import { Collection, CommandInteraction, Guild, GuildTextBasedChannel, Message, MessageCollector, ReadonlyCollection, User } from "discord.js";
import { autoReply } from "../util/commandInteraction";

class Game {
    private gameManager: GameManager;
    private guild: Guild;
    private players: User[];
    private interaction: CommandInteraction;
    private channel: GuildTextBasedChannel;
    private collector: MessageCollector;
    private destroyCallback: (game: Game) => void;

    /**
     * @param gameManager The game manager responsible for this game.
     * @param guild The guild this game is played in.
     * @param players The players participating in this game.
     * @param interaction The interaction to use for output.
     * @param channel The channel the interaction was sent in.
     * @param destroyCallback A callback that gets called when this game stops.
     */
    constructor(gameManager: GameManager, guild: Guild, players: User[], interaction: CommandInteraction, channel: GuildTextBasedChannel, destroyCallback: (game: Game) => void) {
        this.gameManager = gameManager;
        this.guild = guild;
        this.players = players;
        this.interaction = interaction;
        this.channel = channel;
        this.collector = channel.createMessageCollector({
            filter: msg => this.players.includes(msg.author),
            time: 5 * 1000,
        });
        this.destroyCallback = destroyCallback;
    }

    /** Runs this game asyncronously. */
    async run(): Promise<void> {
        autoReply(this.interaction, {
            content: "Game started",
        });

        this.collector.on('collect', async msg => {
            await msg.reply(`This is going to get rate limited so hard. Your message was: ${msg.content}`);
        });

        const collected: ReadonlyCollection<String, Message<boolean>> = await new Promise(resolve => this.collector.on('end', collected => resolve(collected)));

        await autoReply(this.interaction, {
            content: `All done. Collected ${collected.size} item(s).`,
        })

        this.stop();
    }

    /** Stops this game gracefully. */
    private stop(): void {
        this.cleanup();
        this.destroyCallback(this);
    }

    /** Only call if this game has ended. Cleans up any resources used by the game. */
    cleanup(): void {
        if (!this.collector.ended) {
            this.collector.stop();
        }
    }

    getGuild(): Guild {
        return this.guild;
    }

    getPlayers(): User[] {
        return this.players;
    }

    getInteraction(): CommandInteraction {
        return this.interaction;
    }
}

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
        const guildGames: Collection<UserId, Game> = this.games.ensure(guild.id, () => new Collection());
        // Ensure players are not in a game already.
        if (!players.every(user => !guildGames.has(user.id))) {
            await autoReply(interaction, {
                content: "Could not create game: A user is already in a game."
            })
            return;
        }
        // Ensure interaction is coming from a guild text channel.
        if (interaction.channel === null || interaction.channel.isDMBased() || !interaction.channel.isTextBased()) {
            await autoReply(interaction, {
                content: "Could not create game: This is not a server text channel.",
            });
            return;
        }
        // Create new game.
        const game: Game = new Game(this, guild, players, interaction, interaction.channel, game => this.destroyGame(game));
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