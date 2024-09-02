import { assert } from "../util/assert";

/**
 * A seeded random number generator using Xorshift32 with a period of 2^31 - 1.
 * Use to generate approximately uniformly distributed pseudo random numbers.
 */
export class Random {
    private state: number;
    /**
     * @param seed The initial state of the generator. The provided seed will be coerced
     *     into a 32-bit signed integer. If the seed is 0, a seed of -2147483648
     *     (-2^31) is used instead due to Xorshift being unable to seed with 0.
     */
    constructor(seed: number = 0) {
        assert(Number.isInteger(seed), "seed must be an integer");
        this.state = seed ^ 0 || -2147483648;
    }

    /**
     * @returns A random signed 32-bit integer, but never 0.
     */
    private nextIntNonZero(): number {
        this.state ^= this.state << 13;
        this.state ^= this.state >>> 17;
        this.state ^= this.state << 5;
        return this.state;
    }

    /**
     * @returns A random number in [0, 1).
     */
    nextFloat(): number{
        const n = this.nextIntNonZero();
        if (n < 0) {
            return (n + 2147483648) / 4294967295;
        } else {
            return (n + 2147483647) / 4294967295;
        }
    }
}