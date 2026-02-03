import { WorldAfterEvents, WorldBeforeEvents } from "@minecraft/server";

type EventParam<T extends keyof (WorldBeforeEvents | WorldAfterEvents)> =
  Parameters<Parameters<(WorldBeforeEvents[T] & WorldAfterEvents[T])['subscribe']>[0]>[0];

export type PreProcessor = {
  [K in keyof (WorldBeforeEvents & WorldAfterEvents)]:
  (eventData: EventParam<K>) => EventParam<K> | false | void;
};