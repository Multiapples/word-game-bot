import { Collection, User } from "discord.js";

/** Stores data for a player in the game. */
export class Player {
    /** The Discord user playing as this player. */
    user: User;
    /** Damage dealt in the previous wave. */
    waveDamage: number;
    /** Total damage dealt in the current game. */
    totalDamage: number;
    /** Maps all words played by this player during this wave to its score. */
    waveWords: Collection<string, number>;
    /** Maps all words played by this player to its score. */
    allWords: Collection<string, number>;

    constructor(user: User) {
        this.user = user;
        this.waveDamage = 0;
        this.totalDamage = 0;
        this.waveWords = new Collection();
        this.allWords = new Collection();
    }

    /**
     * Updates this player's data as if they had succesfully played the given word in game.
     * @param word The word played.
     * @param score The damage the word scored.
     */
    attributeWord(word: string, score: number): void {
        this.waveDamage += score;
        this.totalDamage += score;
        this.waveWords.set(word, score);
        this.allWords.set(word, score);
    }

    /** Resets all player data whose scope is limited to one wave. */
    resetWave(): void {
        this.waveDamage = 0;
        this.waveWords.clear();
    }
}