export function assert(predicate : boolean, message? : string) : asserts predicate {
    if (!predicate) {
        if (message === undefined) {
            throw new Error();
        } else {
            throw new Error(message);
        }
    }
}
