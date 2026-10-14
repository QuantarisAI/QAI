import type { Item } from "./types";
import { B1, B2 } from "./business/p1";
import { B3, B4, B5 } from "./business/p2";

export const BUSINESS: Item[] = [...B1, ...B2, ...B3, ...B4, ...B5];
