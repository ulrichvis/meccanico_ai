import type { Messages } from "./dictionaries";

type NestedKeyOf<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${NestedKeyOf<T[Key]>}`
      : never;
}[keyof T & string];

export type MessageKey = NestedKeyOf<Messages>;

export function translate(messages: Messages, key: MessageKey): string {
  let value: unknown = messages;

  for (const segment of key.split(".")) {
    if (!value || typeof value !== "object" || !(segment in value)) {
      throw new Error(`Missing translation key: ${key}`);
    }

    value = (value as Record<string, unknown>)[segment];
  }

  if (typeof value !== "string") {
    throw new Error(`Translation key does not resolve to text: ${key}`);
  }

  return value;
}
