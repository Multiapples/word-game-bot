import { APIEmbedField, Collection, CommandInteraction, EmbedBuilder, Guild, GuildTextBasedChannel, Message, MessageCollector, ReadonlyCollection, User } from "discord.js";
import { autoReply } from "../util/commandInteraction";
import { wordList } from "./wordList/wordList";
import { assert } from "../util/assert";

/** Possible game tiles. */
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

/** A mapping of Tile names to Discord emojis */
export enum TileEmoji {
    A = ":regional_indicator_a:",
    B = ":regional_indicator_b:",
    C = ":regional_indicator_c:",
    D = ":regional_indicator_d:",
    E = ":regional_indicator_e:",
    F = ":regional_indicator_f:",
    G = ":regional_indicator_g:",
    H = ":regional_indicator_h:",
    I = ":regional_indicator_i:",
    J = ":regional_indicator_j:",
    K = ":regional_indicator_k:",
    L = ":regional_indicator_l:",
    M = ":regional_indicator_m:",
    N = ":regional_indicator_n:",
    O = ":regional_indicator_o:",
    P = ":regional_indicator_p:",
    Q = ":regional_indicator_q:",
    R = ":regional_indicator_r:",
    S = ":regional_indicator_s:",
    T = ":regional_indicator_t:",
    U = ":regional_indicator_u:",
    V = ":regional_indicator_v:",
    W = ":regional_indicator_w:",
    X = ":regional_indicator_x:",
    Y = ":regional_indicator_y:",
    Z = ":regional_indicator_z:",
    WILD = ":asterisk:",
    WILD_VOWEL = ":zero:",
    WILD_CONSONANT = ":one:",
}
// Assert that every tile has an emoji mapping.
assert(Object.keys(Tile)
    .filter(key => Number.isNaN(Number(key)))
    .every(tileName => TileEmoji[tileName as keyof typeof TileEmoji] !== undefined),
    "A tile is missing an emoji mapping");

export function tileToEmoji(tile: Tile): TileEmoji {
    const tileName = Tile[tile] as keyof typeof Tile;
    return TileEmoji[tileName];
}

export type CAPITAL_LETTER = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

/** The phases of a game */
export enum Phase {
    START,
    WAVE1,
    INTERMISSION1,
    WAVE2,
    INTERMISSION2,
    WAVE3,
    INTERMISSION3,
    END,
}

/** Stores data for a player in the game. */
export class Player {
    /** The Discord user playing as this player. */
    user: User;
    /** Damage dealt in the previous wave. */
    waveDamage: number;
    /** Total damage dealt in the current game. */
    totalDamage: number;
    /** Maps all words played by this player during this wave to their score. */
    waveWords: Collection<string, number>;

    constructor(user: User) {
        this.user = user;
        this.waveDamage = 0;
        this.totalDamage = 0;
        this.waveWords = new Collection();
    }

    resetWave(): void {
        this.waveDamage = 0;
        this.waveWords.clear();
    }
}

const PlayerEmbedColor = 0x00ff00;
const EnemyEmbedColor = 0xff0000;
const NeutralEmbedColor = 0xffff80;

export class Game {
    // Game Manager Related
    private gameManager: GameManager;
    private guild: Guild;
    private users: User[];
    private interaction: CommandInteraction;
    private channel: GuildTextBasedChannel;
    private collector: MessageCollector;
    private destroyCallback: (game: Game) => void;

    // Gameplay Related
    private phase: Phase;
    private tiles: Tile[];
    private tileCount: Collection<Tile, number>;
    private players: Collection<UserId, Player>;
    private wordsPlayed: string[];
    private teamHealth: number;
    private bossHealth: number;

    /**
     * @param gameManager The game manager responsible for this game.
     * @param guild The guild this game is played in.
     * @param users The players participating in this game.
     * @param interaction The interaction to use for output.
     * @param channel The channel the interaction was sent in.
     * @param destroyCallback A callback that gets called when this game stops.
     */
    constructor(gameManager: GameManager, guild: Guild, users: User[], interaction: CommandInteraction, channel: GuildTextBasedChannel, destroyCallback: (game: Game) => void) {
        assert(users.length <= 24, "Too many players"); // Temporary; not very elegant.

        this.gameManager = gameManager;
        this.guild = guild;
        this.users = users;
        this.interaction = interaction;
        this.channel = channel;
        this.collector = channel.createMessageCollector({
            filter: msg => this.users.includes(msg.author),
            time: 15 * 60 * 1000,
        });
        this.destroyCallback = destroyCallback;

        this.phase = Phase.START;
        this.tiles = [];
        this.tileCount = this.generateTileCount(this.tiles);
        this.players = new Collection();
        this.users.forEach(user => this.players.set(user.id, new Player(user)));
        this.wordsPlayed = [];
        this.teamHealth = 15;
        this.bossHealth = 8888;

        this.collector.on('collect', msg => this.onCollectPlayerMessage(msg));
    }

    /** Runs this game asyncronously. */
    async run(): Promise<void> {
        // Ensure the interaction has an initial response.
        await autoReply(this.interaction, {
            content: "Game #727",
        });

        // Start game.
        await this.displayPlayers();
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.displayBossStatus();
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Wave 1.
        this.updateTilePool(this.generateTiles(8));
        await this.displayTiles("Wave 1 | Get Ready");
        await new Promise(resolve => setTimeout(resolve, 2000));
        // // / / / / await this.displayIncomingAttacks(1);

        this.phase = Phase.WAVE1;
        await this.displayWaveTimer(15);

        // Intermission 1. Display results.
        this.phase = Phase.INTERMISSION1;
        await this.displayWordsCrafted("Wave 1 | Words Crafted");
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.displayLeaderboard("Wave 1 | Results");
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.displayHurt("Wave 1 | Damage");
        await new Promise(resolve => setTimeout(resolve, 1000));


        this.players.forEach(player => player.resetWave());
        // Skip waves 2 and 3 for now.

        // End. Display cumulative results.
        this.collector.stop();
        await this.interaction.followUp({
            content: "You win! (for now)",
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.interaction.followUp({
            content: "Leaderboard",
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.interaction.followUp({
            content: "All done",
        });

        this.stop();
    }

    private async onCollectPlayerMessage(msg: Message): Promise<void> {
        const acceptingWords = this.phase === Phase.WAVE1 ||
            this.phase === Phase.WAVE2 ||
            this.phase === Phase.WAVE3;
        if (!acceptingWords) {
            return;
        }

        const player: Player | undefined = this.players.get(msg.author.id);
        assert(player !== undefined, "Collected a message from a non-player");
        const word = msg.content.trim().toLowerCase();
        const unoriginal = this.wordsPlayed.includes(word);
        if (unoriginal) {
            msg.react("🔂")
                .catch(err => {
                    console.error(err)
                });
            return;
        }

        const validWord = wordList.has(word);
        if (!validWord) {
            msg.react("❌")
                .catch(err => {
                    console.error(err)
                });
            return;
        }

        const wordAsTiles = this.wordToTiles(word, this.tileCount);
        const tilesValid = wordAsTiles !== null;
        if (!tilesValid) {
            msg.react("🔢")
                .catch(err => {
                    console.error(err)
                });
            return;
        }

        this.wordsPlayed.push(word);
        const score = this.scoreWord(wordAsTiles);
        player.waveWords.set(word, score);
        player.waveDamage += score;
        player.totalDamage += score;
        try {
            await msg.react("✅")
        } catch (err) {
            console.error(err)
        }
        let scoreToDisplay = score;
        const reactions = ["🔅", "☀️", "⭐", "🪐", "💫", "☄️", "🪩"];
        while (scoreToDisplay > 0) {
            let emoji = "";
            for (let index = reactions.length - 1; index >= 0; index--) {
                const scoreThreshold = Math.pow(2, index);
                if (scoreToDisplay >= scoreThreshold) {
                    scoreToDisplay -= scoreThreshold;
                    emoji = reactions[index];
                    break;
                }
            }
            try {
                await msg.react(emoji)
            } catch (err) {
                console.error(err)
            }
        }
    }

    private async displayPlayers(): Promise<void> {
        const fields: APIEmbedField[] = [];
        for (const player of this.players.values()) {
            fields.push({
                name: player.user.tag,
                value: player.user.tag,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(PlayerEmbedColor)
            .setTitle("Team⚔️")
            .addFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    private async displayBossStatus(): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(EnemyEmbedColor)
            .setTitle("Boss🐙")
            .addFields({ name: "Health", value: `${this.bossHealth}:heart:` });

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    private async displayTiles(title: string): Promise<void> {
        const fields: APIEmbedField[] = [];
        const tilePerRow = 8;
        for (let index = 0; index < this.tiles.length; index += tilePerRow) {
            const rowTiles = this.tiles.slice(index, Math.min(index + tilePerRow, this.tiles.length));
            fields.push({
                name: "_",
                value: rowTiles.map(tileToEmoji).join(" "),
            });
        }

        const embed = new EmbedBuilder()
            .setColor(NeutralEmbedColor)
            .setTitle(title)
            .setDescription("Spell as many words as possible using these tiles.")
            .addFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    private async displayIncomingAttacks(title: string, description: string): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(EnemyEmbedColor)
            .setTitle(title)
            .setDescription(description)
            .addFields(
                { name: ":goblin:", value: "Curse of ra!" },
                { name: ":goblin:", value: "Curse of ra!" },
                { name: ":goblin:", value: "Curse of ra!" },
            );
        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    private async displayWaveTimer(seconds: number): Promise<void> {
        assert(Number.isInteger(seconds));
        assert(seconds >= 1);

        let secondsLeft = seconds;
        const message = "Go!"
        const timerSymbol = ":white_large_square:";
        const embed = new EmbedBuilder()
            .setColor(NeutralEmbedColor)
            .setTitle(message)
            .setDescription(`:clock11:${timerSymbol.repeat(secondsLeft / 5)}`);

        const rep = await this.interaction.followUp({
            embeds: [embed],
        });

        let timeWarning: Message | null = null;
        while (secondsLeft > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            secondsLeft--;

            if (secondsLeft % 5 === 0) {
                let clockNum = Math.floor(12 * secondsLeft / seconds);
                if (clockNum === 0) {
                    clockNum = 12;
                }
                embed.setDescription(`:clock${clockNum}:${timerSymbol.repeat(secondsLeft / 5)}`);
                await rep.edit({
                    embeds: [embed],
                });
            }

            if (secondsLeft === 10) {
                timeWarning = await this.interaction.followUp({
                    content: "10 seconds remaining",
                });
            }
        }

        if (timeWarning !== null) {
            await timeWarning.delete();
        }
    }

    private async displayWordsCrafted(title: string) {
        // Get players from highest to lowest wave damage.
        const playersInOrder = [...this.players.values()]
            .sort((playerA, playerB) => playerB.totalDamage - playerA.totalDamage);

        const fields: APIEmbedField[] = [];
        const wordsPerPlayer = 6; // This stays well under the 1024 char limit for field values.
        for (const player of this.players.values()) {
            // Sort words from highest to lowest score.
            const wordsInOrder: [string, number][] = [...player.waveWords.entries()]
                .sort((entryA, entryB) => entryB[1] - entryA[1]);
            const numWordsToShow = Math.min(wordsPerPlayer, wordsInOrder.length);
            const wordsToShow = wordsInOrder.slice(0, numWordsToShow);
            let lines: string[] = wordsToShow.map(entry => `**${entry[0].toUpperCase()}**: ${entry[1]} dmg`);
            if (lines.length === 0) {
                lines = ["none"];
            }
            if (wordsInOrder.length > wordsPerPlayer) {
                const extraWords = wordsInOrder.length - wordsPerPlayer;
                lines.push(`(...${extraWords} more)`);
            }
            fields.push({
                name: player.user.tag,
                value: lines.join("\n"),
            });
        }

        const embed = new EmbedBuilder()
            .setColor(PlayerEmbedColor)
            .setTitle(title)
            .addFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    private async displayLeaderboard(title: string) {
        // Get players from highest to lowest total damage.
        const playersInOrder = [...this.players.values()]
            .sort((playerA, playerB) => playerB.totalDamage - playerA.totalDamage);

        const fields: APIEmbedField[] = playersInOrder.map(player => ({
            name: player.user.tag,
            value: `+${player.waveDamage} dmg (${player.totalDamage} dmg)`,
        }));

        const embed = new EmbedBuilder()
            .setColor(PlayerEmbedColor)
            .setTitle(title)
            .addFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    private async displayHurt(title: string) {
        let bossHurt = 0;
        this.players.each(player => bossHurt += player.waveDamage);
        const bossHurtSymbol = bossHurt > 0 ? ":boom:" : "";
        const bossField = { name: "Boss🐙", value: `${bossHurtSymbol}${this.bossHealth} :heart:` };

        let teamHurt = 0;
        const teamHurtSymbol = teamHurt > 0 ? ":boom:" : "";
        const teamField = { name: "Team⚔️", value: `${teamHurtSymbol}${this.teamHealth} :heart:` };

        const embed = new EmbedBuilder()
            .setColor(NeutralEmbedColor)
            .setTitle(title)
            .addFields(bossField, teamField);

        const rep: Message = await this.interaction.followUp({
            embeds: [embed],
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        this.bossHealth -= bossHurt;
        bossField.value = `${this.bossHealth} :heart: (-${bossHurt})`;
        this.teamHealth -= teamHurt;
        teamField.value = `${this.teamHealth} :heart: (-${teamHurt})`;
        embed.setFields(bossField, teamField);
        await rep.edit({ embeds: [embed] });
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

    private updateTilePool(tiles: Tile[]) {
        this.tiles = tiles;
        this.tileCount = this.generateTileCount(tiles);
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
        return this.users;
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
