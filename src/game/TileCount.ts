import { Collection } from "discord.js";
import { Tile } from "./Tile";
import { assert } from "../util/assert";

/** Represents a count of tiles, mapping every possible tile to its amount. */
export class TileCount {
    /**
     * A collection keeping track of each tile's count.
     * Every tile must have an entry at all times.
     */
    private count: Collection<Tile, number>;

    /**
     * @param tiles An array of tiles to initialise the count to.
     * @param cloneFrom An optional {@link TileCount} object to clone from.
     *     The `tiles` parameter is ignored if an object is supplied.
     */
    constructor(tiles: Tile[], cloneFrom?: TileCount) {
        if (cloneFrom !== undefined) {
            this.count = cloneFrom.getCollection().clone();
        } else {
            this.count = new Collection();
            for (const key in Tile) {
                // Get only the numeric keys (ie. the reverse mappings in the Tile enum)
                if (isNaN(Number(key))) {
                    continue;
                }
                const tile: Tile = Number(key);
                // Give every tile a count of 0 by default.
                this.count.set(tile, 0);
            }
            for (const tile of tiles) {
                this.count.set(tile, this.count.get(tile)! + 1);
            }
        }
    }

    /**
     * Decrements a value from the tile count collection if its prior value is above zero.
     * @param tile The tile to decrement.
     * @returns `true` if value was decremented and `false` otherwise.
     */
    decrement(tile: Tile): boolean {
        const count: Tile | undefined = this.count.get(tile);
        assert(count !== undefined, "tile count is somehow missing a tile entry");
        if (count > 0) {
            this.count.set(tile, count - 1);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Returns the internal collection that counts each tile.
     * This collection should not be manually altered.
     */
    getCollection(): Collection<Tile, number> {
        return this.count;
    }
}