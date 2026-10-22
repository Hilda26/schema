import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const keytar = require("C:/Users/HP/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar");

const sdk = await import(
  "file:///C:/Users/HP/AppData/Roaming/npm/node_modules/genlayer/node_modules/genlayer-js/dist/index.js"
);
const chains = await import(
  "file:///C:/Users/HP/AppData/Roaming/npm/node_modules/genlayer/node_modules/genlayer-js/dist/chains/index.js"
);

const DEFAULT_CONTRACT_ADDRESS = "";
const OWNER_ACCOUNT = "briefbond-freelancer";

const POLICY = JSON.stringify({
  backward_compatible:
    "Existing payloads valid under the active schema remain valid for new consumers.",
  forward_compatible:
    "Payloads emitted under the new schema remain consumable by existing consumers.",
  rules: [
    "Adding a non-required optional property is BACKWARD_COMPATIBLE with OPTIONAL_ADDITION.",
    "Changing a field type or format is BREAKING.",
    "Adding a required field without a complete default/backfill is BREAKING.",
    "A breaking migration is ADEQUATE only when it specifies dual-read or dual-write, backfill, validation, cutover, and rollback.",
  ],
});

const GENESIS_SCHEMA = JSON.stringify({
  title: "CustomerProfile",
  type: "object",
  required: ["email", "created_at"],
  properties: {
    email: { type: "string", format: "email", meaning: "customer contact email" },
    created_at: { type: "string", format: "date-time", meaning: "account creation instant" },
  },
});

const COMPATIBLE_SCHEMA = JSON.stringify({
  title: "CustomerProfile",
  type: "object",
  required: ["email", "created_at"],
  properties: {
    email: { type: "string", format: "email", meaning: "customer contact email" },
    created_at: { type: "string", format: "date-time", meaning: "account creation instant" },
    display_name: { type: "string", meaning: "optional customer-facing name" },
  },
});

const BREAKING_SCHEMA = JSON.stringify({
  title: "CustomerProfile",
  type: "object",
  required: ["email", "created_at", "account_tier"],
  properties: {
    email: { type: "integer", meaning: "numeric customer identifier" },
    created_at: { type: "string", format: "date", meaning: "account creation calendar date" },
    account_tier: { type: "string", enum: ["free", "pro"] },
  },
});

const INADEQUATE_PLAN = JSON.stringify({
  steps: [],
  note: "Immediate cutover with no dual-read, backfill, validation, or rollback.",
});

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1];
}

async function getClient(accountName) {
  const privateKey = await keytar.getPassword("genlayer-cli", `account:${accountName}`);
  if (!privateKey) throw new Error(`Account ${accountName} is not unlocked in the OS keychain.`);
  const account = sdk.createAccount(privateKey);
  const client = sdk.createClient({ chain: chains.studionet, account });
  await client.initializeConsensusSmartContract();
  return { client, account };
}

function serialize(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries()).map(([key, val]) => [key, serialize(val)]));
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, serialize(val)]));
  }
  return value;
}

function summarizeReceipt(label, hash, receipt) {
  const leader = receipt.consensus_data?.leader_receipt?.[0] ?? {};
  const genvm = leader.genvm_result ?? {};
  const statusName = receipt.status_name ?? receipt.statusName ?? String(receipt.status ?? "");
  const resultName = receipt.result_name ?? receipt.resultName ?? String(receipt.result ?? "");
  const summary = {
    label,
    hash,
    statusName,
    resultName,
    leaderExecution: leader.execution_result ?? "",
    comparativeOutputs: serialize(leader.eq_outputs ?? {}),
    stdout: genvm.stdout ?? "",
    stderr: genvm.stderr ?? "",
    rawError: genvm.raw_error ?? null,
  };
  const accepted = ["FINALIZED", "ACCEPTED"].some((needle) =>
    String(statusName).toUpperCase().includes(needle),
  );
  if (!accepted || summary.leaderExecution === "ERROR" || summary.stderr || summary.rawError) {
    throw new Error(`${label} failed receipt checks: ${JSON.stringify(summary)}`);
  }
  return summary;
}

async function writeTx(client, address, label, functionName, args) {
  const hash = await client.writeContract({ address, functionName, args, value: 0n });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    retries: 180,
    interval: 5000,
  });
  const summary = summarizeReceipt(label, hash, receipt);
  console.log(JSON.stringify(summary));
  return summary;
}

async function readCall(client, address, functionName, args = []) {
  return serialize(await client.readContract({ address, functionName, args }));
}

async function waitUntil(isoTime) {
  const target = Date.parse(isoTime) + 1500;
  while (Date.now() < target) {
    const remaining = target - Date.now();
    console.log(JSON.stringify({ label: "activation-delay-wait", remainingMs: remaining }));
    await new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 15000)));
  }
}

async function main() {
  const contractAddress = argValue("--contract", DEFAULT_CONTRACT_ADDRESS);
  if (!contractAddress) throw new Error("Pass the deployed address with --contract.");
  const outPath = argValue("--out", "live-studionet-latest.json");
  const owner = await getClient(OWNER_ACCOUNT);

  const beforeRegistryCount = Number(await readCall(owner.client, contractAddress, "registry_count"));
  const beforeVersionCount = Number(await readCall(owner.client, contractAddress, "version_count_total"));
  const registryId = beforeRegistryCount;
  const genesisId = beforeVersionCount;
  const compatibleId = beforeVersionCount + 1;
  const breakingId = beforeVersionCount + 2;
  const suffix = `${Date.now()}-${registryId}`;
  const records = [
    {
      label: "initial-read-counts",
      registryCount: beforeRegistryCount,
      versionCount: beforeVersionCount,
      owner: owner.account.address,
    },
  ];

  records.push(
    await writeTx(owner.client, contractAddress, "create-registry", "create_registry", [
      `com.hilda.customer.${suffix}`,
      GENESIS_SCHEMA,
      `sha256:genesis-${suffix}`,
      POLICY,
    ]),
  );
  records.push({
    label: "after-create-registry",
    registry: await readCall(owner.client, contractAddress, "get_registry", [registryId]),
    genesis: await readCall(owner.client, contractAddress, "get_version", [genesisId]),
  });

  records.push(
    await writeTx(owner.client, contractAddress, "propose-compatible-version", "propose_version", [
      registryId,
      COMPATIBLE_SCHEMA,
      `sha256:compatible-${suffix}`,
      JSON.stringify({ note: "No migration required for an optional property." }),
      60,
    ]),
  );
  records.push(
    await writeTx(owner.client, contractAddress, "analyze-compatible-version", "analyze_version", [
      compatibleId,
    ]),
  );

  const analyzedCompatible = await readCall(
    owner.client,
    contractAddress,
    "get_version",
    [compatibleId],
  );
  records.push({ label: "after-compatible-analysis", version: analyzedCompatible });
  if (analyzedCompatible.status !== "ANALYZED") {
    throw new Error(`Expected compatible version ANALYZED, got ${JSON.stringify(analyzedCompatible)}`);
  }
  if (!["FULLY_COMPATIBLE", "BACKWARD_COMPATIBLE"].includes(analyzedCompatible.classification)) {
    throw new Error(`Unexpected compatible classification: ${analyzedCompatible.classification}`);
  }

  await waitUntil(analyzedCompatible.activate_after);
  records.push(
    await writeTx(owner.client, contractAddress, "activate-compatible-version", "activate_version", [
      compatibleId,
    ]),
  );

  records.push(
    await writeTx(owner.client, contractAddress, "propose-breaking-version", "propose_version", [
      registryId,
      BREAKING_SCHEMA,
      `sha256:breaking-${suffix}`,
      INADEQUATE_PLAN,
      60,
    ]),
  );
  records.push(
    await writeTx(owner.client, contractAddress, "analyze-breaking-version", "analyze_version", [
      breakingId,
    ]),
  );

  const finalRegistry = await readCall(owner.client, contractAddress, "get_registry", [registryId]);
  const finalGenesis = await readCall(owner.client, contractAddress, "get_version", [genesisId]);
  const finalCompatible = await readCall(owner.client, contractAddress, "get_version", [compatibleId]);
  const finalBreaking = await readCall(owner.client, contractAddress, "get_version", [breakingId]);
  const compatibleEdge = await readCall(
    owner.client,
    contractAddress,
    "get_compatibility",
    [genesisId, compatibleId],
  );
  const breakingEdge = await readCall(
    owner.client,
    contractAddress,
    "get_compatibility",
    [compatibleId, breakingId],
  );
  const finalRegistryCount = Number(await readCall(owner.client, contractAddress, "registry_count"));
  const finalVersionCount = Number(await readCall(owner.client, contractAddress, "version_count_total"));

  records.push({ label: "final-registry", registry: finalRegistry });
  records.push({ label: "final-genesis", version: finalGenesis });
  records.push({ label: "final-compatible", version: finalCompatible, edge: compatibleEdge });
  records.push({ label: "final-breaking", version: finalBreaking, edge: breakingEdge });
  records.push({
    label: "final-counts",
    registryCount: finalRegistryCount,
    versionCount: finalVersionCount,
  });

  if (finalRegistry.current_version_id !== compatibleId) {
    throw new Error(`Expected current version ${compatibleId}, got ${finalRegistry.current_version_id}`);
  }
  if (finalGenesis.status !== "DEPRECATED" || finalCompatible.status !== "ACTIVE") {
    throw new Error("Activation did not deprecate genesis and activate the compatible version.");
  }
  if (
    finalBreaking.status !== "BLOCKED" ||
    finalBreaking.classification !== "BREAKING" ||
    finalBreaking.migration_assessment !== "INADEQUATE"
  ) {
    throw new Error(`Expected breaking version BLOCKED/INADEQUATE, got ${JSON.stringify(finalBreaking)}`);
  }
  if (finalRegistryCount !== beforeRegistryCount + 1 || finalVersionCount !== beforeVersionCount + 3) {
    throw new Error("Final counters do not match one registry and three versions.");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    contractAddress,
    registryId,
    genesisId,
    compatibleId,
    breakingId,
    passed: true,
    records,
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outPath, passed: true, registryId, genesisId, compatibleId, breakingId }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
