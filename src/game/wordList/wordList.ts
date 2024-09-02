import { createReadStream } from "fs"
import { createInterface } from "readline"
import { once } from "events"
import { assert } from "../../util/assert";

async function readWordList(path: string) {
    const rs = createReadStream(path) as unknown as NodeJS.ReadableStream; // Evil type cast

    const wordList: string[] = [];

    const rl = createInterface({
        input: rs,
        crlfDelay: Infinity,
    }) as unknown as NodeJS.EventEmitter; // Evil type cast


    rl.on("line", line => {
        assert(typeof (line) === "string");
        if (line.startsWith("#") || line.length === 0) {
            return;
        }
        line = line.toLowerCase().replace(/[^a-z]/g, ""); // Not the fastest but this only needs to be run once at the beginning of the process.
        wordList.push(line);
    })

    await once(rl, "close");

    return wordList;
}

/** The word pool for the game. */
export const wordList: Set<string> = new Set();
export const commonWordList: Set<string> = new Set();

/**
 * Populates {@link wordList} and {@link commonWordList} with words. Must be called
 * exactly once.
 */
export async function initWordList(): Promise<void> {
    (await readWordList("src/game/wordList/wordsWordnik.txt"))
        .forEach(word => wordList.add(word));
    (await readWordList("src/game/wordList/words3of6game.txt"))
        .forEach(word => {
            wordList.add(word);
            commonWordList.add(word);
        });
    (await readWordList("src/game/wordList/wordsCustom.txt"))
        .forEach(word => wordList.add(word));
}

