import { WorldAfterEvents, WorldBeforeEvents, system, world } from "@minecraft/server";

import EventEmitter from "./src/eventemitter3/index";

export class Module {
    static modules = [];

    emitter = new EventEmitter()

    static debugging = true;

    log(...params) {
        params.unshift(`[${this.name}] [${this.version}] [LOG]`)
        console.log(...params);
    }

    debug(...params) {
        if (!Module.debugging) return;
        params.unshift(`[${this.name}] [${this.version}] [DEBUG]`)
        console.info(...params);
    }

    /** @type {boolean} */
    active = true;

    tickerId;
    /** @type {import("./src/preProcessor").PreProcessor[]} */
    preProcessors = [];

    static defaultOptions = {
        name: "",
        description: "",
        category: "",
        version: "v0.0.0",
        author: "",
        dependencies: [],
        active: true,
        tickRate: 1
    }

    constructor(options = Module.defaultOptions) {
        Object.seal(Module.defaultOptions)
        Module.modules.push(this);

        options = { ...Module.defaultOptions, ...options }

        for (const key in options) {
            this[key] = options[key];
        }

        console.log(JSON.stringify(this))
        this.setupInternals();

        this.setState?.(this.active)

        system.run(() => {
            system.beforeEvents.startup.subscribe(this.onStartup)
            system.beforeEvents.shutdown.subscribe(this.onShutdown)
        })
    }

    setupInternals() {
        this.emitter.on('call_onEnable', () => {
            this.tickerId = system.runInterval(() => {
                this.onTick();
            }, this.tickRate);
        })
        this.emitter.on('call_onDisable', () => {
            if (!this.tickerId) return;
            system.clearRun(this.tickerId);
        })
    }
    /**
     * @param {boolean} state
     * @returns changed
     */
    setState(state) {
        const oldState = this.active;
        this.active = state;

        this.debug(`this.active = ${state} (old: ${oldState})`);

        this.onState?.(state, oldState);
        state ? this.onEnable?.() : this.onDisable?.();

        return state == oldState;
    }

    /** @remarks This function is called when the script (not the module) is loaded. */
    onStartup() { }
    /** @remarks This function is called when the script (not the module) is shutdown. */
    onShutdown() { }

    onState(newState, oldState) { }
    onEnable() { }
    onDisable() { }
    onTick() { }

    /** @param {import("./src/preProcessor").PreProcessor} preProcessor */
    use(preProcessor) {
        this.preProcessors.push(preProcessor)
    }

    static getAllPrototypeInstances(object, prototype = undefined) {
        const instances = [];
        for (const key in object) {
            if (typeof object[key] != "object") {
                continue;
            }

            const proto = Object.getPrototypeOf(object[key]);
            if (!prototype || proto.constructor.name == prototype.constructor.name) {
                instances.push({ prototype: proto, instance: object[key] });
            }
            instances.push(...Module.getAllPrototypeInstances(object[key], prototype));
        }

        return instances;
    }

    /** @private */
    preProcess(event, data) {
        for (const preProcessorTable of this.preProcessors) {
            let tempData, tempFn;

            {
                const tempFn = preProcessorTable[event]
                tempData = tempFn?.call?.(this, data);
                if (tempData === false) return false;

                if (tempData !== true && !!tempData)
                    data = tempData;
            }

             {
                const allInstances = Module.getAllPrototypeInstances(data)
                const keys = Object.keys(preProcessorTable)
                keys.forEach(key => {
                    if (!key.startsWith("function "))
                        return;

                    let prototypeName = key.split(" ")[1];
                    prototypeName = prototypeName.replace("()", "")

                    const instances = allInstances.filter(i => i.prototype.constructor.name == prototypeName)
                    if (instances.length == 0) return;
                    const tempFn = preProcessorTable[key]

                    for (const instance of instances) {
                        tempData = tempFn?.call?.(this, instance.instance);
                        if (tempData === false) return false;

                        if (tempData !== true && !!tempData)
                            data = tempData;
                    }
                })
            }

            {
                tempFn = preProcessorTable['*']
                tempData = tempFn?.call?.(this, event, data);
                if (tempData === false) return false;

                if (tempData !== true && !!tempData)
                    data = tempData;
            }
        }

        return data;
    }

    /** @private */
    static eventGetter(target, key) {
        const event = target[key];
        return {
            subscribe: (cb) => {
                event.subscribe((...args) => {
                    if (!this.active) return;
                    const data = args[0];

                    let fakeValues = {};

                    const generateProxy = (data) => {
                        return new Proxy(data, {
                            set: (target, key, value) => {
                                try {
                                    target[key] = value;
                                } catch {
                                    fakeValues[key] = value;
                                }
                                return true;
                            },
                            get: (target, key) => {
                                if (key in fakeValues)
                                    return fakeValues[key];

                                if (typeof target[key] == "object")
                                    return generateProxy(target[key]);
                                if (typeof target[key] == "function")
                                    return target[key].bind(target)

                                return target[key]
                            }
                        })
                    }

                    let proxiedData = generateProxy(data)

                    proxiedData = this.preProcess(key, proxiedData)

                    args[0] = proxiedData;
                    if (args[0] === false) return;
                    try {
                        cb(...args);
                    } catch (e) {
                        console.error(e)
                        console.error("args", JSON.stringify(args))
                    }
                })
            },
            unsubscribe: event.unsubscribe
        }
    }

    /** @type {WorldBeforeEvents} */
    get beforeEvents() {
        return new Proxy(world.beforeEvents, {
            get: Module.eventGetter.bind(this)
        })
    }

    /** @type {WorldAfterEvents} */
    get afterEvents() {
        return new Proxy(world.afterEvents, {
            get: Module.eventGetter.bind(this)
        })
    }
}

const setupMethodInternals = () => {
    const ignoredMethods = [
        "wrap",
        "log",
        "debug",
        "constructor"
    ];

    const callables = Object.getOwnPropertyNames(Module.prototype).filter(i => !ignoredMethods.includes(i))
    callables.forEach(key => {
        if (typeof Module.prototype[key] != "function") return;
        if (key.startsWith("_")) return;
        const orig = Module.prototype[key];
        Module.prototype[key] = function (...args) {
            this?.emitter?.emit?.('call_' + key, ...args);
            return orig.call(this, ...args)
        }
    })
}

setupMethodInternals();

globalThis.Module = Module;