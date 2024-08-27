import { createReadStream } from "fs"
import { createInterface } from "readline"
import { once } from "events"

async function readWordList() {
    const rs = createReadStream("src/game/wordList/wordList.txt") as unknown as NodeJS.ReadableStream; // Evil type cast

    const wordList: string[] = [];

    const rl = createInterface({
        input: rs,
        crlfDelay: Infinity,
    }) as unknown as NodeJS.EventEmitter; // Evil type cast


    rl.on("line", line => {
        if (line.startsWith("#") || line.length === 0) {
            return;
        }
        wordList.push(line);
    })

    await once(rl, "close");

    return wordList;
}

/** The word pool for the game. */
export const wordList: Set<string> = new Set();

/** Populates {@link wordList} with words. Must be called exactly once. */
export async function initWordList(): Promise<void> {
    (await readWordList())
        .forEach(word => wordList.add(word));
}

