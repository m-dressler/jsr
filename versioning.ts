/**
 * Updates the version in `deno.json(c)` based on the provided primary version.
 *
 * @example
 * ```sh
 * deno run -RW --allow-run=git jsr:@md/jsr/v patch
 * ```
 *
 * @module
 */

import { parse } from "@std/jsonc/";
import { format } from "@std/semver/format";
import { tryParse } from "@std/semver/try-parse";

/** All the valid primary versions */
const primaries = ["major", "minor", "patch"] as const;
/** The primary version to increment from the arguments */
const primary = Deno.args[0] as (typeof primaries)[number];

// If the argument is not a valid primary, exit with error
if (!primaries.includes(primary)) {
  console.error(
    `Invalid argument "${primary}". Please use one of ${primaries.join(", ")}`,
  );
  Deno.exit(1);
}

const denoTextFiles = await Promise.all(
  ["./deno.jsonc", "./deno.json"].map(async (path) => ({
    path,
    text: await Deno.readTextFile(path).catch(() => {}),
  })),
);

/** The deno.json file as text read from the current directory */
const denoJsonFile = denoTextFiles.find(
  (v): v is { path: string; text: string } => !!v.text,
);
if (!denoJsonFile) {
  console.error(
    'Couldn\'t read "deno.jsonc" or "deno.json". Are you in the right directory?',
  );
  Deno.exit(1);
}

const denoJson = denoJsonFile.path.endsWith("jsonc")
  ? parse(denoJsonFile.text)
  : JSON.parse(denoJsonFile.text);

/** The version string as specified in {@link denoJson} */
const versionString =
  // If it's not a valid string, fall back to `0.0.0`
  typeof denoJson["version"] === "string" ? denoJson["version"] : "0.0.0";
/** The parsed version with fallback to `0.0.0` if not a valid semver */
const version = tryParse(versionString) || tryParse("0.0.0")!;

// Increment version at selected primary
version[primary]++;
// Reset all sub-primaries back to 0
for (let i = primaries.indexOf(primary) + 1; i < primaries.length; ++i) {
  version[primaries[i]] = 0;
}
// Remove prerelease and build info
delete version.prerelease;
delete version.build;

const updatedVersion = format(version);

// Write back to deno.json. We're not using JSON.stringify so we don't change formatting
// If we can find the old version string, update it
if (denoJsonFile.text.includes(`"${versionString}"`)) {
  denoJsonFile.text = denoJsonFile.text.replace(
    new RegExp(`("version":\\s*)"${versionString}"`),
    `$1"${updatedVersion}"`,
  );
} //If it isn't included it, the original semver was missing/invalid so we remove any version key and add versioning back in
else {
  // Remove any invalid version key
  denoJsonFile.text = denoJsonFile.text.replace(
    /\s*"version":\s*"\w*"\s*(,\s*\n)?/,
    "",
  );
  // Add the updated version key to the beginning
  denoJsonFile.text = denoJsonFile.text.replace(
    "{",
    `{\n  "version": "${updatedVersion}",`,
  );
}
await Deno.writeTextFile(denoJsonFile.path, denoJsonFile.text);

console.log(
  `Updated version from \x1b[33m${version}\x1b[0m to \x1b[33m${updatedVersion}\x1b[0m`,
);

// Create a new commit if a git folder exists
await Deno.stat(".git/")
  .then(() => {
    // Create git commit
    new Deno.Command("git", {
      args: ["commit", "-am", updatedVersion],
    }).outputSync();
    // Tag last commit
    new Deno.Command("git", {
      args: ["tag", `v${updatedVersion}`],
    }).outputSync();
    console.log("Committed changes to git");
  })
  .catch((err) => {
    // If it doesn't exist, we don't mind, otherwise, bubble up error
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  });
