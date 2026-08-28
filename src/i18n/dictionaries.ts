import englishMessages from "../../messages/en.json";
import italianMessages from "../../messages/it.json";

import type { Locale } from "./config";

export type Messages = typeof englishMessages;

export const dictionaries = {
  en: englishMessages,
  it: italianMessages,
} satisfies Record<Locale, Messages>;
