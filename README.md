# @md/jsr

A Deno runnable to quickly set up and manage a JSR repository scaffold.

## How to use

Create a new project: `deno create -W @md/jsr`

Create a new semver release for the current project:

- Patch: `deno run -RW --allow-run=git jsr:@md/jsr/v patch`
- Minor: `deno run -RW --allow-run=git jsr:@md/jsr/v minor`
- Major: `deno run -RW --allow-run=git jsr:@md/jsr/v major`

To more easily run versioning commands, add
`alias denov="deno run -RW --allow-run=git jsr:@md/jsr/v"` to your shell and use
it as `denov patch`.
