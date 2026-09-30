import { isMockDiscord } from '../config.js';
import { LiveDiscordGateway } from './live.js';
import { MockDiscordGateway } from './mock.js';
import type { DiscordGateway } from './types.js';

let gateway: DiscordGateway = isMockDiscord ? new MockDiscordGateway() : new LiveDiscordGateway();

export const discord = (): DiscordGateway => gateway;

/** Réservé aux tests. */
export const setDiscordGateway = (g: DiscordGateway) => {
  gateway = g;
};
