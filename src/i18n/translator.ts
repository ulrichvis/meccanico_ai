import type { Messages } from "./dictionaries";

type NestedKeyOf<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${NestedKeyOf<T[Key]>}`
      : never;
}[keyof T & string];

export type MessageKey = NestedKeyOf<Messages>;

type TranslationValues = Record<string, string | number>;

export function translate(
  messages: Messages,
  key: MessageKey,
  values?: TranslationValues,
): string {
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

  if (!values) {
    return value;
  }

  return value.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}
