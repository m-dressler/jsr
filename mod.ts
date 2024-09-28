/** The regex used by deno to validate deno.json['name'] */
const JSR_NAME_REGEX = /^@[a-z0-9-]+\/[a-z0-9-]+$/;

/** The JSR name compliant project name */
let projectName: string | null = null;
// Get the project name from the user via the terminal
while (!projectName) {
  const result = prompt("Enter the project name (@scope/package):");
  if (!result) continue;

  if (JSR_NAME_REGEX.test(result)) projectName = result;
  else console.log("Invalid project name. Must match regex", JSR_NAME_REGEX);
}

const [scope, packageName] = projectName.split("/");

// Get the project description from the user via the terminal
const projectDescription = prompt("Enter the project description:") || "";

/** The folder to create the project in */
const parentFolder = projectName.replace("/", ":");

/** The entire file structure to create */
const directoryStructure = {
  "deno.json": JSON.stringify(
    {
      name: projectName,
      version: "0.0.0",
      license: "ISC",
      exports: "./mod.ts",
      exclude: [".github/", ".gitignore"],
    },
    null,
    2
  ),
  "mod.ts": `console.log("Hello from ${projectName}!");`,
  "mod_test.ts": `import { assertEquals } from "jsr:@std/assert/equals";

Deno.test("Example", () => {
  assertEquals(1 + 1, 2);
});`,
  "README.md": `# ${projectName}\n\n${projectDescription}\n\n## Example\n\n\`\`\`\n// TODO\n\`\`\``,
  ".gitignore": [".env", ".DS_Store"].join("\n"),
  ".vscode/settings.json": JSON.stringify({
    "deno.enable": true,
    "typescript.tsserver.experimental.enableProjectDiagnostics": false,
  }),
  ".vscode/.gitignore": "*",
  ".github/workflows/publish.yaml": `name: Publish

on:
  push:
    branches:
      - main

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # The OIDC ID token is used for authentication with JSR.
    steps:
      - uses: actions/checkout@v4
      - name: Publish package
        run: npx jsr publish
`,
} as const satisfies Record<string, string>;

// Create the parent directory
await Deno.mkdir(parentFolder, { recursive: true });

// Create all the files in `directoryStructure` in parallel
const promises = Object.entries(directoryStructure).map(
  async ([name, content]) => {
    const path = `${parentFolder}/${name}`;
    if (name.includes("/")) {
      const parentDir = path.substring(0, path.lastIndexOf("/"));
      await Deno.mkdir(parentDir, { recursive: true });
    }
    return Deno.writeTextFile(path, content);
  }
);

// Await all files to be created
await Promise.all(promises);

console.log(`Project created successfully!

Next steps:

Create GitHub repository:
  1. https://github.com/new?name=${packageName}&description=${encodeURIComponent(
  projectDescription
)}

Create JSR package: 
  1. https://jsr.io/new?scope=${scope.substring(1)}&package=${packageName}
  2. Open settings (https://jsr.io/${projectName}/settings)
  2. Add project description:

    ${projectDescription}

  3. Connect to github project (${packageName})

Publish changes to github
  1. \`cd ${parentFolder}\`
  2. \`git init\`
  2. \`git add .\`
  3. \`git commit -m "Initial commit"\`
  4. Follow instructions in GitHub from the section
     "…or push an existing repository from the command line"
`);
