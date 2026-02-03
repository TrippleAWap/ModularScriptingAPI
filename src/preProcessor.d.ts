import { WorldAfterEvents, WorldBeforeEvents } from "@minecraft/server";

type PreDefined = {
  '*': <T extends keyof (WorldBeforeEvents & WorldAfterEvents) >(event: T, data: EventParam<T>) => EventParam<T> | false | void;
}

type EventParam<T extends keyof (WorldBeforeEvents & WorldAfterEvents)> =
  Parameters<Parameters<(WorldBeforeEvents[T] & WorldAfterEvents[T])['subscribe']>[0]>[0];

type PreProcessorObject =
  {
    [K in keyof PreDefined]: PreDefined[K]
  } & {
    [K in keyof (WorldBeforeEvents & WorldAfterEvents)]:
    (eventData: EventParam<K>) => EventParam<K> | false | void;
  };

export type PreProcessor = PreProcessorObject;