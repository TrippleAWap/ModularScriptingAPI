/**
 * @remarks This function is used to emit every function call of an object into the emitter of the module.
 */
const setupMemberCallEmitter = (object) => {
    const ignoredMethods = [
        "log",
        "debug",
        "constructor"
    ];

    const callables = Object.getOwnPropertyNames(object).filter(i => !ignoredMethods.includes(i))
    callables.forEach(key => {
        if (typeof object[key] != "function") return;
        if (key.startsWith("_")) return;
        const prototype = Object.getPrototypeOf(object);
        const orig = prototype[key];
        prototype[key] = function (...args) {
            this?.emitter?.emit?.('call_' + key, ...args);
            return orig.call(this, ...args)
        }
    })
}

export {
    setupMemberCallEmitter,
}