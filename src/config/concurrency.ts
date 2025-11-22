import pLimit from "p-limit";
import { EventEmitter } from "events";

/*
    By default node.js can have 10 event listeners per event.
    Increasing it to manage Agents concurrent requests.
*/
EventEmitter.setMaxListeners(100);

export const MAX_CONCURRENT_CHUNKS = 2;
export const MAX_CONCURRENT_AGENTS = 5;

export const chunkConcurrency = pLimit(MAX_CONCURRENT_CHUNKS);
export const agentConcurrency = pLimit(MAX_CONCURRENT_AGENTS);