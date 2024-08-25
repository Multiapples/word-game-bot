import { Collection, CommandInteraction, Guild, GuildTextBasedChannel, Message, MessageCollector, ReadonlyCollection, User } from "discord.js";
import { autoReply } from "../util/commandInteraction";

/**
 * An enum representing possible game tiles.
 * Values are enumerated sequentially starting from 0.
 */
export enum Tile {
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S,
    T,
    U,
    V,
    W,
    X,
    Y,
    Z,
    WILD,
    WILD_VOWEL,
    WILD_CONSONANT,
}

export type CAPITAL_LETTER = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z"

export class Game {
    private gameManager: GameManager;
    private guild: Guild;
    private players: User[];
    private interaction: CommandInteraction;
    private channel: GuildTextBasedChannel;
    private collector: MessageCollector;
    private destroyCallback: (game: Game) => void;

    private tiles: Tile[];
    private tileCount: Collection<Tile, number>;

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
            time: 1 * 60 * 1000,
        });
        this.destroyCallback = destroyCallback;

        this.tiles = this.generateTiles();
        this.tileCount = this.generateTileCount(this.tiles);
    }

    /** Runs this game asyncronously. */
    async run(): Promise<void> {
        await autoReply(this.interaction, {
            content: "Game started",
        });

        await this.interaction.followUp({
            content: `Tiles: \`\`${this.tiles.map(tile => "ABCDEFGHIJKLMNOPQRSTUVWXYZ*vc?????"[tile]).join("")}\`\``,
        })

        this.collector.on('collect', async msg => {
            if (this.testWordTiles(msg.content.trim(), this.tileCount)) {
                msg.react(["🔅", "🔆", "⭐", "💫", "☄️"][Math.floor(Math.random() * 5)])
                    .catch(err => {
                        console.error(err)
                    });
            } else {
                msg.react("❌")
                    .catch(err => {
                        console.error(err)
                    });
            }
        });

        const collected: ReadonlyCollection<String, Message<boolean>> = await new Promise(resolve => this.collector.on('end', collected => resolve(collected)));

        await this.interaction.followUp({
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

    /** Generates an array of random tiles. */
    private generateTiles(): Tile[] {
        const tiles: Tile[] = [];
        for (let i = 0; i < 6; i++) {
            tiles.push(Math.floor(Math.random() * 29));
        }
        return tiles;
    }

    /**
     * Returns a collection with the number of times each tile appears in the received
     * array. Tiles that never appear are assigned a value of 0 in the collection.
     */
    private generateTileCount(tiles: Tile[]): Collection<Tile, number> {
        const count = new Collection<Tile, number>();
        for (const tile in Tile) {
            if (isNaN(Number(tile))) {
                continue;
            }
            count.ensure(Number(tile), () => 0);
        }
        for (const tile of tiles) {
            count.set(tile, count.get(tile)! + 1);
        }
        return count;
    }

    /**
     * Checks whether a word can be spelt using the given tiles. Returns true or false
     * accordingly.
     */
    private testWordTiles(word: string, tileCount: Collection<Tile, number>): boolean {
        // Check that word is not empty string.
        if (word.length === 0) {
            return false;
        }
        // Check that word only contains A-Z
        word = word.toUpperCase();
        const capAlphaOnly = /^[A-Z]*$/g;
        if (!capAlphaOnly.test(word)) {
            return false;
        }
        // Count tiles used in the word.
        const counts = tileCount.clone();
        const extraLetters: CAPITAL_LETTER[] = [];
        for (let char of word as unknown as CAPITAL_LETTER[]) {
            let count = counts.get(Tile[char])!;
            if (count > 0) {
                counts.set(Tile[char], count - 1);
            } else {
                extraLetters.push(char);
            }
        }
        // Count wild vowels and consonants. Y is dealt with later.
        let wilds = counts.get(Tile.WILD)!;
        let wildVowels = counts.get(Tile.WILD_VOWEL)!;
        let wildConsonants = counts.get(Tile.WILD_CONSONANT)!;
        let yCount = 0;
        for (let char of extraLetters) {
            if ("AEIOU".includes(char)) {
                wildVowels--;
            } else if ("BCDFGHJKLMNPQRSTVWXZ".includes(char)) {
                wildConsonants--;
            } else if (char === "Y") {
                yCount++;
            }
        }
        // Use wilds to cover extra vowels and consonants.
        if (wildVowels < 0) {
            wilds += wildVowels;
            wildVowels = 0;
        }
        if (wildConsonants < 0) {
            wilds += wildConsonants;
            wildConsonants = 0;
        }
        if (wilds < 0) {
            return false; // Out of wilds
        }
        // Check that remaining wild types can cover Y's. Note that all wild types can become a Y.
        if (yCount > wilds + wildConsonants + wildVowels) {
            return false;
        }
        return true;
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