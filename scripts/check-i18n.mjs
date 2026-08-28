import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const catalogUrls = {
  en: new URL("../messages/en.json", import.meta.url),
  it: new URL("../messages/it.json", import.meta.url),
};

const interpolationPattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

function flattenCatalog(value, prefix = "", result = new Map()) {
  if (typeof value === "string") {
    result.set(prefix, {
      type: "string",
      variables: [...value.matchAll(interpolationPattern)]
        .map((match) => match[1])
        .sort(),
    });
    return result;
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    result.set(prefix, { type: Array.isArray(value) ? "array" : typeof value });
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    flattenCatalog(child, prefix ? `${prefix}.${key}` : key, result);
  }

  return result;
}

async function loadCatalog(locale, url) {
  const path = fileURLToPath(url);

  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read the ${locale} catalog at ${path}.`, {
      cause: error,
    });
  }
}

function compareCatalogs(referenceLocale, reference, candidateLocale, candidate) {
  const errors = [];
  const allKeys = new Set([...reference.keys(), ...candidate.keys()]);

  for (const key of [...allKeys].sort()) {
    const referenceEntry = reference.get(key);
    const candidateEntry = candidate.get(key);

    if (!referenceEntry) {
      errors.push(`${candidateLocale} contains an extra key: ${key}`);
      continue;
    }

    if (!candidateEntry) {
      errors.push(`${candidateLocale} is missing key: ${key}`);
      continue;
    }

    if (referenceEntry.type !== candidateEntry.type) {
      errors.push(
        `${key} has type ${referenceEntry.type} in ${referenceLocale} and ${candidateEntry.type} in ${candidateLocale}.`,
      );
      continue;
    }

    if (referenceEntry.variables.join(",") !== candidateEntry.variables.join(",")) {
      errors.push(`${key} uses different interpolation variables across locales.`);
    }
  }

  return errors;
}

const english = flattenCatalog(await loadCatalog("en", catalogUrls.en));
const italian = flattenCatalog(await loadCatalog("it", catalogUrls.it));
const errors = compareCatalogs("en", english, "it", italian);

if (errors.length > 0) {
  console.error("Translation catalog validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Translation catalogs are valid and contain ${english.size} matching keys.`);
}
