import { assert } from "../util/assert";
import { Random } from "./Random";

export type CAPITAL_LETTER = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

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

/** Returns an associated emoji for a given tile. */
export function tileToEmoji(tile: Tile): TileEmoji {
    const tileName = Tile[tile] as keyof typeof Tile;
    return TileEmoji[tileName];
}

/**
 * Returns a random tile.
 * @param random A random number generator. Will be polled once.
 */
export function randomTile(random: Random): Tile {
    const values = Object.values(Tile).filter(value => typeof (value) === "number");
    return values[random.nextInt(0, values.length)];
}

/**
 * @param random A random number generator. Will be polled once.
 * @returns A random vowel, including 'Y'.
 */
export function randomVowel(random: Random): Tile {
    const keys: CAPITAL_LETTER[] = ["A", "E", "I", "O", "U", "Y"];
    return Tile[keys[random.nextInt(0, keys.length)]];
}

/**
 * @param random A random number generator. Will be polled once.
 * @returns A random consonant, including 'Y'.
 */
export function randomConsonant(random: Random): Tile {
    const keys: CAPITAL_LETTER[] = ["B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z"];
    return Tile[keys[random.nextInt(0, keys.length)]];
}
