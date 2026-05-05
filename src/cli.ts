#!/usr/bin/env node
import { Command } from "commander";
import { resolveDefaults } from "./config.js";
import { pullUseCase } from "./pull.js";

const program = new Command();

program
  .name("wiki-sync")
  .description("Pull and normalize DokuWiki page data into JSON files.")
  .showHelpAfterError("(use --help for usage and examples)");

program
  .command("pull")
  .description("Sync one supported dataset into a destination JSON file.")
  .argument("<use-case>", "Dataset/use-case name (currently: working-groups)")
  .requiredOption("--out <absolute-path>", "Absolute output JSON file path")
  .option("--host <url>", "Local wiki base URL (default: http://127.0.0.1:8765)")
  .option("--token <jwt>", "JWT bearer token; defaults to WIKI_SYNC_TOKEN env")
  .option("--dokuwiki-root <path>", "Path to dokuwiki root (default: ../dokuwiki from cwd)")
  .option("--wiki-conf-root <path>", "Path to wiki-conf root (default: ../wiki-conf from cwd)")
  .option("--api-user <username>", "Wiki user to mint token for when temporarily enabling API", "apiclient")
  .option("--enable-api-temp", "Temporarily enable API in local conf while command runs", true)
  .option("--disable-api-temp", "Disable temporary API enablement")
  .option("--verbose", "Print extra debug information", false)
  .action(async (useCase, rawOptions) => {
    try {
      const options = resolveDefaults({
        useCase,
        out: rawOptions.out,
        host: rawOptions.host,
        token: rawOptions.token,
        dokuwikiRoot: rawOptions.dokuwikiRoot,
        wikiConfRoot: rawOptions.wikiConfRoot,
        apiUser: rawOptions.apiUser,
        enableApiTemp: rawOptions.disableApiTemp ? false : Boolean(rawOptions.enableApiTemp),
        verbose: Boolean(rawOptions.verbose),
      });

      const result = await pullUseCase(options);
      console.log(`Wrote ${result.outputPath} for use case "${result.useCase}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`wiki-sync pull failed: ${message}`);
      console.error("Required args: <use-case> --out <absolute-path>");
      console.error("Supported use-cases: working-groups");
      console.error("Try: wiki-sync pull --help");
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
