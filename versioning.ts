import { tryParse } from "@std/semver/try-parse";
import { format } from "@std/semver/format";

/** All the valid primary versions */
const primaries = ["major", "minor", "patch"] as const;
/** The primary version to increment from the arguments */
const primary = Deno.args[0] as (typeof primaries)[number];

// If the argument is not a valid primary, exit with error
if (!primaries.includes(primary)) {
  console.error(
    `Invalid argument "${primary}". Please use one of ${primaries.join(", ")}`
  );
  Deno.exit(1);
}

/** The deno.json file as text read from the current directory */
let denoJsonText = await Deno.readTextFile("./deno.json").catch(() => {
  console.error('Couldn\'t read "deno.json". Are you in the right directory?');
  Deno.exit(1);
});

/** The JSON parsed deno.json file from the current directory*/
let denoJson: Record<string, unknown>;
try {
  denoJson = JSON.parse(denoJsonText);
} catch {
  console.error('"deno.json" isn\t a valid JSON file.');
  Deno.exit(1);
}

/** The version string as specified in {@link denoJson} */
const versionString =
  // If it's not a valid string, fall back to `0.0.0`
  typeof denoJson["version"] === "string" ? denoJson["version"] : "0.0.0";
/** The parsed version with fallback to `0.0.0` if not a valid semver */
const version = tryParse(versionString) || tryParse("0.0.0")!;

// Increment version at selected primary
version[primary]++;
// Reset all sub-primaries back to 0
for (let i = primaries.indexOf(primary) + 1; i < primaries.length; ++i)
  version[primaries[i]] = 0;
// Remove prerelease and build info
delete version.prerelease;
delete version.build;

const updatedVersion = format(version);

// Write back to deno.json. We're not using JSON.stringify so we don't change formatting
// If we can find the old version string, update it
if (denoJsonText.includes(`"${versionString}"`))
  denoJsonText = denoJsonText.replace(
    new RegExp(`("version":\\s*)"${versionString}"`),
    `$1"${updatedVersion}"`
  );
//If it isn't included it, the original semver was missing/invalid so we remove any version key and add versioning back in
else {
  // Remove any invalid version key
  denoJsonText = denoJsonText.replace(/\s*"version":\s*"\w*"\s*(,\s*\n)?/, "");
  // Add the updated version key to the beginning
  denoJsonText = denoJsonText.replace(
    "{",
    `{\n  "version": "${updatedVersion}",`
  );
}
await Deno.writeTextFile("./deno.json", denoJsonText);

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
  })
  .catch((err) => {
    // If it doesn't exist, we don't mind, otherwise, bubble up error
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  });
