# ModularScriptingAPI
**ModularScriptingAPI** is a *framework* for creating Minecraft Bedrock Edition scripting API that introdues *modularity and extensibility* to the scripting API.

> This introduces a modular concept where removing or adding modules can be 
done without affecting the rest of the API.
___

## Example
This short example demonstrates how to create a chat module that cleans the message and sends it to the server. It also contains a global preprocessor used for a `/nick` system.

```js
import { world, Player } from "@minecraft/server";
import { Module } from "./ModularScriptingAPI/src/Module";

class ChatModule extends Module {
    constructor() {
        super({
            name: "ChatModule",
            description: "A module that handles all chat messages.",
        })

        this.use({
            // Create preprocessor to clean the message and remove all 
            // non-alphanumeric characters from the message. 
            "chatSend": (data) => {
                data.message = data.message.replace(/[^a-zA-Z0-9]/g, "").trim();
            },
            // This should never be called considering we don't explicity subscribe to this event.
            "effectAdd": () => {
                console.error(`unexpected call to effectAdd in ${this.name}`)
            }
        })
    }

    onStartup() {
        this.beforeEvents.chatSend.subscribe((data) => {
            data.cancel = true;
            const { sender: player, message } = data;
            if (message.length == 0) return;
            world.sendMessage(`§7${player.name} §l§b>§r ${message}`);
        });
    }
}

// useGlobal ensures this preproccesor is used on all modules.
// WARNING: This may be dangerous and cause conflicts if used incorrectly.
// It is recommended to use this sparingly and only for modules that require it.
Module.useGlobal({
    /** @param {Player} player */
    [Player]: (player) => {
        for (const tag of player.getTags()) {
            if (!tag.startsWith("nick:")) continue;
            player.name = tag.substring(5);
            break;
        }
    }
})

new ChatModule();
```