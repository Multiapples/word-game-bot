import { Guild, User, CommandInteraction, GuildTextBasedChannel, MessageCollector, Collection, Message, APIEmbedField, EmbedBuilder, ColorResolvable } from "discord.js";
import { assert } from "../util/assert";
import { autoReply } from "../util/commandInteraction";
import { GameManager } from "./GameManager";
import { Player } from "./Player";
import { Tile, tileToEmoji, CAPITAL_LETTER, randomTile, randomConsonant, randomVowel } from "./Tile";
import { wordList } from "./wordList/wordList";
import { Random } from "./Random";
import { TileCount } from "./TileCount";
import { getRandomObjective, Objective } from "./Objectives";


const playerEmbedColor = 0x00ff00;
const enemyEmbedColor = 0xff0000;
const neutralEmbedColor = 0xffff80;

const bossSymbol = "🐙";
const teamSymbol = "⚔️";

/** The phases of a game */
enum Phase {
    START,
    WAVE1,
    INTERMISSION1,
    WAVE2,
    INTERMISSION2,
    WAVE3,
    INTERMISSION3,
    END,
}

type UserId = String;

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
    private day: number;
    private random: Random;
    private phase: Phase;
    private tiles: Tile[];
    private tileCount: TileCount;
    private currentObjectives: Objective[];
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
     * @param day An integer that determines which unique random game to play.
     */
    constructor(gameManager: GameManager, guild: Guild, users: User[],
        interaction: CommandInteraction, channel: GuildTextBasedChannel,
        destroyCallback: (game: Game) => void, day: number) {

        assert(users.length <= 22, "Too many players"); // Temporary; not very elegant.

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

        this.day = day;
        this.random = new Random(day);
        this.phase = Phase.START;
        this.tiles = [];
        this.tileCount = new TileCount(this.tiles);
        this.currentObjectives = [];
        this.players = new Collection();
        this.users.forEach(user => this.players.set(user.id, new Player(user)));
        this.wordsPlayed = [];
        this.teamHealth = 15;
        this.bossHealth = 60;

        this.collector.on('collect', msg => this.onCollectPlayerMessage(msg));
    }

    /** Runs this game asyncronously. */
    async run(): Promise<void> {
        // Ensure the interaction has an initial response.
        await autoReply(this.interaction, {
            content: `Game #${this.day}`,
        });

        // Pre-generate game data.
        const tilesPerWave: Tile[][] = [
            [
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomVowel(this.random),
                randomVowel(this.random),
                randomVowel(this.random),
                randomConsonant(this.random),
                randomConsonant(this.random),
            ],
            [
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomVowel(this.random),
                randomVowel(this.random),
                Tile.WILD,
            ],
            [
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomConsonant(this.random),
                randomVowel(this.random),
                randomVowel(this.random),
                Tile.WILD_VOWEL,
                Tile.WILD_CONSONANT,
                Tile.WILD,
            ],
        ];
        const objectivesPerWave: Objective[][] = [
            [],
            [
                getRandomObjective(5, this.random),
                getRandomObjective(4, this.random),
                getRandomObjective(3, this.random),
                getRandomObjective(2, this.random),
                getRandomObjective(2, this.random),
            ],
            [
                getRandomObjective(6, this.random),
                getRandomObjective(5, this.random),
                getRandomObjective(4, this.random),
                getRandomObjective(3, this.random),
                getRandomObjective(3, this.random),
            ],
        ];


        // Start
        await this.displayPlayers();
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.displayBossStatus();
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Waves
        const waves = 3;
        for (let wave = 1; wave <= 3; wave++) {
            assert(wave === 1 || wave === 2 || wave === 3);
            const finalWave = wave === waves;

            if (finalWave) {
                await this.displayTitle("Final Wave", neutralEmbedColor);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            this.currentObjectives = objectivesPerWave[wave - 1];
            if (this.currentObjectives.length > 0) {
                await this.displayIncomingAttacks(
                    `Wave ${wave} | Incoming Enemies`,
                    "Defend yourself this wave"
                );
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            let newTiles: Tile[] = tilesPerWave[wave - 1];
            this.updateTilePool([...this.tiles, ...newTiles]);
            await this.displayTiles(`Wave ${wave} | Get Ready`);
            await new Promise(resolve => setTimeout(resolve, 1000 + 1000 * wave));

            this.phase = Phase[`WAVE${wave}`];
            await this.displayWaveTimer(15);

            this.phase = Phase[`INTERMISSION${wave}`];
            await this.displayWordsCrafted(`Wave ${wave} | Words Crafted`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            await this.displayHurt(`Wave ${wave} | Damage`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (this.teamHealth <= 0) {
                break;
            }

            await this.displayLeaderboard(`Wave ${wave} | Results`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            this.players.forEach(player => player.resetWave());
        }

        // End
        this.phase = Phase.END;
        this.collector.stop();
        if (this.teamHealth <= 0) {
            await this.displayTitle("YOU DIED :fearful:", enemyEmbedColor);
        } else if (this.bossHealth <= 0) {
            await this.displayTitle(`You defeated the boss! ${teamSymbol}`, playerEmbedColor);
        } else {
            await this.displayTitle(`The boss got away! ${bossSymbol}`, neutralEmbedColor);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.displayGameRecap("Performance");
        await this.interaction.followUp({
            content: "All done",
        });

        this.stop();
    }

    /**
     * Called when a message is collected from a player of this game.
     * Processes and evaluated the player's word.
     */
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
        player.attributeWord(word, score);

        const reactions = ["🔅", "☀️", "⭐", "🪐", "💫", "☄️", "🪩"];
        let scoreToDisplay = Math.min(score, Math.pow(2, reactions.length) - 1);
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

    /** Outputs an embed with the list of players. */
    private async displayPlayers(): Promise<void> {
        const fields: APIEmbedField[] = [];
        this.players.each(player => {
            fields.push({
                name: player.user.tag,
                value: player.user.tag,
            });
        });

        const embed = new EmbedBuilder()
            .setColor(playerEmbedColor)
            .setTitle(`Team${teamSymbol}`)
            .addFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    /** Outputs an embed of the boss health. */
    private async displayBossStatus(): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(enemyEmbedColor)
            .setTitle(`Boss${bossSymbol}`)
            .addFields({ name: "Health", value: `${this.bossHealth}:heart:` });

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    /** Outputs an embed displaying the tiles in play. */
    private async displayTiles(title: string): Promise<void> {
        const tilePerRow = 8;
        const rows: string[] = [];
        for (let index = 0; index < this.tiles.length; index += tilePerRow) {
            const rowTiles = this.tiles.slice(index, index + tilePerRow);
            rows.push(rowTiles.map(tileToEmoji).join(" "));
        }

        const embed = new EmbedBuilder()
            .setColor(playerEmbedColor)
            .setTitle(title)
            .setDescription("Spell as many words as possible using these tiles.")
            .addFields({
                name: "Tiles",
                value: rows.join("\n"),
            });

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    /** Outputs an embed of incoming enemy attack objectives. */
    private async displayIncomingAttacks(title: string, description: string): Promise<void> {
        const fields: APIEmbedField[] = this.currentObjectives
            .map(obj => ({
                name: `(-${obj.getDamage()}${":squid:".repeat(obj.getDamage())})`,
                value: obj.getDescription(),
            }));

        const embed = new EmbedBuilder()
            .setColor(enemyEmbedColor)
            .setTitle(title)
            .setDescription(description);

        const rep: Message = await this.interaction.followUp({ embeds: [embed] });
        await new Promise(resolve => setTimeout(resolve, 1000));

        for (let index = 0; index < fields.length; index++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            embed.setFields(fields.slice(0, index + 1));
            await rep.edit({ embeds: [embed] });
        }
    }

    /** Outputs an embed displaying a timer and updates that timer until it expires. */
    private async displayWaveTimer(seconds: number): Promise<void> {
        assert(Number.isInteger(seconds));
        assert(seconds >= 1);

        let secondsLeft = seconds;
        const message = "Go!"
        const timerSymbol = ":white_large_square:";
        const embed = new EmbedBuilder()
            .setColor(neutralEmbedColor)
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

    /** Outputs an embed displaying words played by each player in a wave. */
    private async displayWordsCrafted(title: string): Promise<void> {
        // Get players from highest to lowest wave damage.
        const playersInOrder = [...this.players.values()]
            .sort((playerA, playerB) => playerB.totalDamage - playerA.totalDamage);

        const fields: APIEmbedField[] = [];
        const wordsPerPlayer = 6; // This stays well under the 1024 char limit for field values.
        this.players.each(player => {
            // Sort words from highest to lowest score.
            const wordsInOrder: [string, number][] = [...player.waveWords.entries()]
                .sort((entryA, entryB) => entryB[1] - entryA[1]);
            const wordsToShow = wordsInOrder.slice(0, wordsPerPlayer);
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
        });

        const embed = new EmbedBuilder()
            .setColor(neutralEmbedColor)
            .setTitle(title)
            .addFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    /** Outputs an embed leaderbaord displaying damage dealt by players. */
    private async displayLeaderboard(title: string): Promise<void> {
        // Get players from highest to lowest total damage.
        const playersInOrder = [...this.players.values()]
            .sort((playerA, playerB) => playerB.totalDamage - playerA.totalDamage);

        const fields: APIEmbedField[] = playersInOrder.map(player => ({
            name: player.user.tag,
            value: `+${player.waveDamage} dmg (${player.totalDamage} dmg)`,
        }));

        const embed = new EmbedBuilder()
            .setColor(neutralEmbedColor)
            .setTitle(title)
            .addFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    /** Outputs an embed displaying damage dealt after a wave. */
    private async displayHurt(title: string): Promise<void> {
        let bossHurt = 0;
        this.players.each(player => bossHurt += player.waveDamage);
        const bossHurtSymbol = bossHurt > 0 ? ":boom:" : "";
        const bossField = { name: `Boss${bossSymbol}`, value: `${bossHurtSymbol}${this.bossHealth} :heart:` };

        let teamHurt = 0;
        const teamHurtSymbol = teamHurt > 0 ? ":boom:" : "";
        const teamField = { name: `Team${teamSymbol}`, value: `${teamHurtSymbol}${this.teamHealth} :heart:` };

        const embed = new EmbedBuilder()
            .setColor(neutralEmbedColor)
            .setTitle(title)
            .addFields(bossField, teamField);

        const rep: Message = await this.interaction.followUp({
            embeds: [embed],
        });

        await new Promise(resolve => setTimeout(resolve, 1500));

        this.bossHealth -= bossHurt;
        bossField.value = `${this.bossHealth} :heart: (-${bossHurt})`;
        this.teamHealth -= teamHurt;
        teamField.value = `${this.teamHealth} :heart: (-${teamHurt})`;
        embed.setFields(bossField, teamField);
        await rep.edit({ embeds: [embed] });
    }

    /** Outputs an embed with only a title and color. */
    async displayTitle(title: string, color: ColorResolvable | null): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title);

        await this.interaction.followUp({
            embeds: [embed],
        });
    }

    /** Outputs an embed with overall statistic for each player. */
    async displayGameRecap(title: string): Promise<void> {
        const fields: APIEmbedField[] = [];
        const playersInOrder = [...this.players.entries()]
            .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
            .map(entry => entry[1]);
        playersInOrder.forEach(player => {
            const items: string[] = [];
            items.push(`**Total Damage**: ${player.totalDamage} dmg`);
            items.push("**Best Words**:");
            const sortedWords: [string, number][] = [...player.allWords.entries()];
            const topWords: string[] = sortedWords
                .sort((a, b) => b[1] - a[1]).slice(0, 3)
                .map(entry => `${entry[0].toUpperCase()} (${entry[1]})`);
            items.push(...topWords);
            fields.push({
                name: player.user.tag,
                value: items.join("\n")
            });
        });

        const embed = new EmbedBuilder()
            .setColor(neutralEmbedColor)
            .setTitle(title)
            .setFields(fields);

        await this.interaction.followUp({
            embeds: [embed],
        });
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

    private updateTilePool(tiles: Tile[]) {
        this.tiles = tiles;
        this.tileCount = new TileCount(tiles);
    }

    /**
     * Spells out a word using a set of tiles.
     * @param word The word to spell.
     * @param tileCount The number of each tile type available. Each type of tile must
     *     have a non-negative value in the collection.
     * @returns An array of tiles. If the word cannot be spelt with the given tiles, null
     *     is returned instead.
     */
    private wordToTiles(word: string, tileCount: TileCount): Tile[] | null {
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
        const counts = new TileCount([], tileCount);
        const wordAsTiles: (Tile | null)[] = [];
        for (const char of word as unknown as CAPITAL_LETTER[]) {
            const tile = Tile[char];
            if (counts.decrement(tile)) {
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
                if (counts.decrement(Tile.WILD_VOWEL)) {
                    wordAsTiles[index] = Tile.WILD_VOWEL;
                } else if (counts.decrement(Tile.WILD)) {
                    wordAsTiles[index] = Tile.WILD;
                } else {
                    return null; // Cannot spell word.
                }
            } else if ("BCDFGHJKLMNPQRSTVWXZ".includes(char)) {
                if (counts.decrement(Tile.WILD_CONSONANT)) {
                    wordAsTiles[index] = Tile.WILD_CONSONANT;
                } else if (counts.decrement(Tile.WILD)) {
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
            if (counts.decrement(Tile.WILD_VOWEL)) {
                wordAsTiles[index] = Tile.WILD_VOWEL;
            } else if (counts.decrement(Tile.WILD_CONSONANT)) {
                wordAsTiles[index] = Tile.WILD_CONSONANT;
            } else if (counts.decrement(Tile.WILD)) {
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