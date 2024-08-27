import { Collection, CommandInteraction, Guild, GuildTextBasedChannel, Message, MessageCollector, ReadonlyCollection, User } from "discord.js";
import { autoReply } from "../util/commandInteraction";
import { wordList } from "./wordList/wordList";
import { assert } from "../util/assert";

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

        this.tiles = this.generateTiles(20);
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
            const word = msg.content.trim().toUpperCase();
            const recognizedWord = wordList.has(word.toLowerCase());
            const wordAsTiles = this.wordToTiles(msg.content.trim(), this.tileCount);
            const tilesValid = wordAsTiles !== null;
            if (!recognizedWord) {
                msg.react("❌")
                    .catch(err => {
                        console.error(err)
                    });
                return;
            }
            if (!tilesValid) {
                msg.react("🔢")
                    .catch(err => {
                        console.error(err)
                    });
                return;
            }
            msg.reply({
                content: `score: ${this.scoreWord(wordAsTiles)}`,
            })
            await msg.react("✅")
                .catch(err => {
                    console.error(err)
                })
            await msg.react(["🔅", "🔆", "⭐", "💫", "☄️"][Math.floor(Math.random() * 5)])
                .catch(err => {
                    console.error(err)
                });
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
    private generateTiles(length: number): Tile[] {
        assert(Number.isInteger(length));
        assert(length >= 0);
        const tiles: Tile[] = [];
        for (let i = 0; i < length; i++) {
            tiles.push(Math.floor(Math.random() * (Object.keys(Tile).length / 2)));
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
     * Decrements a value from a tile count collection.
     * @param collection A collection holding an amount of each tile.
     * @param tile The tile to decrement. The collection must have a value for this tile.
     * @returns `true` if value was decremented and `false` otherwise.
     */
    private decrementTileCount(collection: Collection<Tile, number>, tile: Tile): boolean {
        const count: Tile | undefined = collection.get(tile);
        assert(count !== undefined, "Tile count collection does not have value for tile.")
        if (count > 0) {
            collection.set(tile, count - 1);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Spells out a word using a set of tiles.
     * @param word The word to spell.
     * @param tileCount The number of each tile type available. Each type of tile must
     *     have a non-negative value in the collection.
     * @returns An array of tiles. If the word cannot be spelt with the given tiles, null
     *     is returned instead.
     */
    private wordToTiles(word: string, tileCount: Collection<Tile, number>): Tile[] | null {
        // Check that the word is not an empty string.
        if (word.length === 0) {
            return null;
        }
        // Check that the word only contains A-Z.
        word = word.toUpperCase();
        const capAlphaOnly = /^[A-Z]*$/g;
        if (!capAlphaOnly.test(word)) {
            return null;
        }
        // Fill the word with regular tiles.
        const counts = tileCount.clone();
        const wordAsTiles: (Tile | null)[] = [];
        for (const char of word as unknown as CAPITAL_LETTER[]) {
            const tile = Tile[char];
            if (this.decrementTileCount(counts, tile)) {
                wordAsTiles.push(tile);
            } else {
                wordAsTiles.push(null);
            }
        }
        // Replace missing tiles with wild types, except Y's.
        for (let index = 0; index < this.tiles.length; index++) {
            const char = word[index] as CAPITAL_LETTER;
            if (wordAsTiles[index] !== null || char == "Y") {
                continue;
            }
            if ("AEIOU".includes(char)) {
                if (this.decrementTileCount(counts, Tile.WILD_VOWEL)) {
                    wordAsTiles[index] = Tile.WILD_VOWEL;
                } else if (this.decrementTileCount(counts, Tile.WILD)) {
                    wordAsTiles[index] = Tile.WILD;
                } else {
                    return null; // Cannot spell word.
                }
            } else if ("BCDFGHJKLMNPQRSTVWXZ".includes(char)) {
                if (this.decrementTileCount(counts, Tile.WILD_CONSONANT)) {
                    wordAsTiles[index] = Tile.WILD_CONSONANT;
                } else if (this.decrementTileCount(counts, Tile.WILD)) {
                    wordAsTiles[index] = Tile.WILD;
                } else {
                    return null; // Cannot spell word.
                }
            }
        }
        // Replace missing Y tiles with wild types.
        for (let index = 0; index < this.tiles.length; index++) {
            const char = word[index] as CAPITAL_LETTER;
            if (wordAsTiles[index] !== null || char !== "Y") {
                continue;
            }
            if (this.decrementTileCount(counts, Tile.WILD_VOWEL)) {
                wordAsTiles[index] = Tile.WILD_VOWEL;
            } else if (this.decrementTileCount(counts, Tile.WILD_CONSONANT)) {
                wordAsTiles[index] = Tile.WILD_CONSONANT;
            } else if (this.decrementTileCount(counts, Tile.WILD)) {
                wordAsTiles[index] = Tile.WILD;
            } else {
                return null; // Cannot spell word.
            }
        }
        // Assert no null tiles, then return.
        for (const tile of wordAsTiles) {
            assert(tile !== null, "null tile leftover.");
        }
        return wordAsTiles as Tile[];
    }

    /** Calculates a score for tiles spelling out a word. */
    private scoreWord(tiles: Tile[]): number {
        let score = 0;
        let nonWildTiles = 0;
        for (const tile of tiles) {
            switch (tile) {
                case Tile.E:
                case Tile.S:
                case Tile.I:
                case Tile.A:
                case Tile.R:
                case Tile.N:
                case Tile.T:
                case Tile.O:
                case Tile.L:
                case Tile.C:
                case Tile.D:
                case Tile.U:
                    score += 1;
                    nonWildTiles++;
                    break;
                case Tile.G:
                case Tile.P:
                case Tile.M:
                case Tile.H:
                case Tile.B:
                case Tile.Y:
                case Tile.F:
                    score += 2;
                    nonWildTiles++;
                    break;
                case Tile.V:
                case Tile.K:
                case Tile.W:
                    score += 3;
                    nonWildTiles++;
                    break;
                case Tile.Z:
                case Tile.X:
                case Tile.J:
                case Tile.Q:
                    score += 5;
                    nonWildTiles++;
                    break;
                case Tile.WILD:
                case Tile.WILD_CONSONANT:
                case Tile.WILD_VOWEL:
                    break;
            }
        }
        const lengthBonus = Math.max(0, tiles.length - 3) * nonWildTiles;
        score += lengthBonus;
        return score;
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
