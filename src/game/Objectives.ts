import { Collection } from "discord.js";
import { assert } from "../util/assert";
import { Random } from "./Random";

/** Represents an objective the players must complete to defend against enemies. */
export interface Objective {
    /** Returns a string description for the criteria to fulfill this objective. */
    getDescription(): string;
    /** Returns the damage that will be dealt to the team if they fail this objective. */
    getDamage(): number;
    /** Returns true or false depending on whether a word fulfills this objective. */
    meetsObjective(word: string, score: number): boolean;
}

class BaseObjective {
    private damage: number;
    constructor(damage: number) {
        assert(Number.isInteger(damage));
        assert(damage > 0);
        this.damage = damage;
    }
    getDamage(): number {
        return this.damage;
    }
}

class LengthObjective extends BaseObjective implements Objective {
    private length: number;
    constructor(damage: number, length: number) {
        super(damage);
        assert(Number.isInteger(length));
        assert(length > 0);
        this.length = length;
    }
    getDescription(): string {
        return `Spell a word at least ${this.length} long`;
    }
    meetsObjective(word: string, score: number): boolean {
        return word.length >= this.length;
    }
}

class DamageObjective extends BaseObjective implements Objective {
    private score: number;
    constructor(damage: number, score: number) {
        super(damage);
        assert(Number.isInteger(damage));
        assert(score > 0);
        this.score = score;
    }
    getDescription(): string {
        return `Spell a word dealing at least ${this.score} dmg`;
    }
    meetsObjective(word: string, score: number): boolean {
        return score >= this.score;
    }
}

class PrefixObjective extends BaseObjective implements Objective {
    private prefix: string;
    constructor(damage: number, prefix: string) {
        super(damage);
        assert(prefix.length > 0);
        this.prefix = prefix.toLowerCase();
    }
    getDescription(): string {
        return `Spell a word starting with ${this.prefix.toUpperCase()}`;
    }
    meetsObjective(word: string, score: number): boolean {
        return word.startsWith(this.prefix);
    }
}

class SuffixObjective extends BaseObjective implements Objective {
    private suffix: string;
    constructor(damage: number, suffix: string) {
        super(damage);
        assert(suffix.length > 0);
        this.suffix = suffix.toLowerCase();
    }
    getDescription(): string {
        return `Spell a word ending with ${this.suffix.toUpperCase()}`;
    }
    meetsObjective(word: string, score: number): boolean {
        return word.endsWith(this.suffix);
    }
}

class DoubleConsonantObjective extends BaseObjective implements Objective {
    constructor(damage: number) {
        super(damage);
    }
    getDescription(): string {
        return `Spell a word with doubled consonants`;
    }
    meetsObjective(word: string, score: number): boolean {
        const doubleLettersRegex = /([A-Z])\1/
        return doubleLettersRegex.test(word);
    }
}

const objectivePool: Objective[][] = [
    [
        new LengthObjective(2, 4),
        new LengthObjective(3, 5),
        new LengthObjective(4, 6),
        new LengthObjective(5, 7),
        new LengthObjective(5, 8),
        new LengthObjective(6, 9),
    ],
    [
        new DamageObjective(2, 8),
        new DamageObjective(3, 15),
        new DamageObjective(4, 24),
        new DamageObjective(5, 35),
        new DamageObjective(6, 48),
    ],
    [
        new PrefixObjective(2, "S"),
        new PrefixObjective(2, "C"),
        new PrefixObjective(2, "P"),
        new PrefixObjective(2, "D"),
        new PrefixObjective(3, "J"),
        new PrefixObjective(3, "K"),
        new PrefixObjective(3, "N"),
        new PrefixObjective(3, "O"),
        new PrefixObjective(3, "V"),
    ],
    [
        new SuffixObjective(2, "S"),
        new SuffixObjective(3, "IVE"),
        new SuffixObjective(4, "IC"),
        new SuffixObjective(5, "ENCE"),
    ],
    [
        new DoubleConsonantObjective(3),
    ],
];

const objectivePoolsByDamage = new Collection<number, Objective[][]>();
for (let damage = 2; damage <= 6; damage++) {
    const objectives: Objective[][] = objectivePool
        .map(pool => pool.filter(obj => obj.getDamage() === damage))
        .filter(pool => pool.length > 0);
    objectivePoolsByDamage.set(damage, objectives);
}

/**
 * Returns a random object with the specified damage.
 * @param damage The amount of damage the objective will have.
 * @param random A random number generator. It will be polled twice.
 */
export function getRandomObjective(damage: 2 | 3 | 4 | 5 | 6, random: Random): Objective {
    const pools = objectivePoolsByDamage.get(damage);
    assert(pools !== undefined);
    const pool = pools[random.nextInt(0, pools.length)];
    const objective = pool[random.nextInt(0, pool.length)];
    return objective;
}
