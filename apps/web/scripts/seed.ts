import { createDefaultSeedSnapshot, writeSeedSnapshotToFile } from "../src/lib/seed";

type SeedScriptOptions = {
  output: string;
  referenceTime: string;
};

function parseArgs(argv: string[]): SeedScriptOptions {
  const options: SeedScriptOptions = {
    output: ".seed/local-seed.json",
    referenceTime: new Date().toISOString()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--output") {
      options.output = argv[index + 1] ?? options.output;
      index += 1;
      continue;
    }

    if (arg === "--reference-time") {
      options.referenceTime = argv[index + 1] ?? options.referenceTime;
      index += 1;
      continue;
    }
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = createDefaultSeedSnapshot(options.referenceTime);
  const resolvedPath = writeSeedSnapshotToFile(snapshot, options.output);

  console.info("[seed] local seed snapshot written");
  console.info(`  file: ${resolvedPath}`);
  console.info(`  users: ${snapshot.users.length}`);
  console.info(`  posts: ${snapshot.posts.length}`);
  console.info(`  reports: ${snapshot.reports.length}`);
  console.info(`  appeals: ${snapshot.appeals.length}`);
  console.info("");
  console.info("Next steps:");
  console.info(`  1) export HUMANONLY_SEED_FILE=${options.output}`);
  console.info("  2) npm run dev");
  console.info("");
  console.info("Local seeded handles:");
  console.info("  - chief_admin (admin)");
  console.info("  - queue_mod (moderator)");
  console.info("  - human_author (member)");
  console.info("  - civic_reader (member)");
}

main();
