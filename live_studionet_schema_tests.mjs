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

const CONTRACT_ADDRESS = "0xF7E17581A1A281a697b45894dff8F71dda8B1A8b";
const SPONSOR_ACCOUNT = "briefbond-freelancer";
const MAPPER_ACCOUNT = "briefbond-trigger";

const SOURCE_PROFILE = JSON.stringify({
  dataset: "studio_live_crm_export",
  fields: [
    { name: "customer_email", meaning: "email address used as customer identifier" },
    { name: "signup_ts", meaning: "customer signup timestamp in ISO-8601 format" },
    { name: "ltv_cents", meaning: "customer lifetime value stored as integer cents" },
    { name: "region_code", meaning: "two-letter sales region code" },
  ],
});

const TARGET_SCHEMA = JSON.stringify({
  entity: "Customer",
  required_fields: [
    { name: "email", type: "string", meaning: "customer email address" },
    { name: "signup_date", type: "date", meaning: "calendar date of signup" },
    { name: "lifetime_value_usd", type: "decimal", meaning: "lifetime value in US dollars" },
    { name: "region", type: "string", meaning: "sales region code" },
  ],
});

const QUALITY_RUBRIC = JSON.stringify({
  must: [
    "map every required target field",
    "convert ltv_cents to lifetime_value_usd by dividing by 100",
    "derive signup_date from signup_ts by parsing the ISO timestamp and keeping the date",
    "copy region_code to region without inventing a new value",
  ],
  reject_if: [
    "a required target field is missing",
    "a mapped source field has a different semantic meaning",
    "a transform or unit conversion is ambiguous",
  ],
});

const GOOD_MAPPING = JSON.stringify({
  fields: [
    { target: "email", source: "customer_email", transform: "copy exact string" },
    { target: "signup_date", source: "signup_ts", transform: "parse ISO-8601 timestamp and keep YYYY-MM-DD date" },
    { target: "lifetime_value_usd", source: "ltv_cents", transform: "divide integer cents by 100 and express as USD decimal" },
    { target: "region", source: "region_code", transform: "copy exact string" },
  ],
});

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1];
}

async function getClient(accountName) {
  const privateKey = await keytar.getPassword("genlayer-cli", `account:${accountName}`);
  if (!privateKey) {
    throw new Error(`Account ${accountName} is not unlocked in the OS keychain.`);
  }
  const account = sdk.createAccount(privateKey);
  const client = sdk.createClient({ chain: chains.studionet, account });
  await client.initializeConsensusSmartContract();
  return { client, account, accountName };
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
    stdout: genvm.stdout ?? "",
    stderr: genvm.stderr ?? "",
    rawError: genvm.raw_error ?? null,
  };
  const okStatus = ["FINALIZED", "ACCEPTED"].some((needle) => String(statusName).toUpperCase().includes(needle));
  if (!okStatus || summary.leaderExecution === "ERROR" || summary.stderr || summary.rawError) {
    throw new Error(`${label} failed receipt checks: ${JSON.stringify(summary)}`);
  }
  return summary;
}

async function writeTx(client, label, functionName, args, value = 0n) {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    retries: 120,
    interval: 5000,
  });
  const summary = summarizeReceipt(label, hash, receipt);
  console.log(JSON.stringify(summary));
  return summary;
}

async function readCall(client, functionName, args = []) {
  return serialize(
    await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
    }),
  );
}

async function main() {
  const outPath = argValue("--out", `C:/contracts/schema-live-studionet-${Date.now()}.json`);
  const sponsor = await getClient(SPONSOR_ACCOUNT);
  const mapper = await getClient(MAPPER_ACCOUNT);

  const beforeTaskCount = Number(await readCall(sponsor.client, "task_count"));
  const beforeSubmissionCount = Number(await readCall(sponsor.client, "submission_count_total"));
  const taskId = beforeTaskCount;
  const submissionId = beforeSubmissionCount;
  const suffix = `${Date.now()}-${taskId}`;

  const records = [];
  records.push({
    label: "initial-read-counts",
    taskCount: beforeTaskCount,
    submissionCount: beforeSubmissionCount,
    sponsor: sponsor.account.address,
    mapper: mapper.account.address,
  });

  records.push(
    await writeTx(
      sponsor.client,
      "create-task",
      "create_task",
      [
        SOURCE_PROFILE,
        TARGET_SCHEMA,
        QUALITY_RUBRIC,
        `sha256:live-schema-map-${suffix}`,
        1,
        3600,
        3600,
      ],
      1n,
    ),
  );

  const afterCreateTask = await readCall(sponsor.client, "get_task", [taskId]);
  records.push({ label: "after-create-get-task", taskId, task: afterCreateTask });

  records.push(
    await writeTx(
      mapper.client,
      "submit-good-mapping",
      "submit_mapping",
      [taskId, GOOD_MAPPING],
    ),
  );

  const afterSubmit = await readCall(sponsor.client, "get_submission", [submissionId]);
  records.push({ label: "after-submit-get-submission", submissionId, submission: afterSubmit });

  records.push(
    await writeTx(
      sponsor.client,
      "review-good-mapping",
      "review_mapping",
      [submissionId],
    ),
  );

  const finalTask = await readCall(sponsor.client, "get_task", [taskId]);
  const finalSubmission = await readCall(sponsor.client, "get_submission", [submissionId]);
  const finalTaskCount = Number(await readCall(sponsor.client, "task_count"));
  const finalSubmissionCount = Number(await readCall(sponsor.client, "submission_count_total"));

  records.push({ label: "final-get-task", taskId, task: finalTask });
  records.push({ label: "final-get-submission", submissionId, submission: finalSubmission });
  records.push({
    label: "final-read-counts",
    taskCount: finalTaskCount,
    submissionCount: finalSubmissionCount,
  });

  if (finalTask.state !== "AWARDED") {
    throw new Error(`Expected final task state AWARDED, got ${finalTask.state}`);
  }
  if (String(finalTask.winner).toLowerCase() !== String(mapper.account.address).toLowerCase()) {
    throw new Error(`Expected winner ${mapper.account.address}, got ${finalTask.winner}`);
  }
  if (finalTask.decision_code !== "MAPPING_ACCEPTED") {
    throw new Error(`Expected MAPPING_ACCEPTED, got ${finalTask.decision_code}`);
  }
  if (finalSubmission.status !== "ACCEPTED") {
    throw new Error(`Expected final submission ACCEPTED, got ${finalSubmission.status}`);
  }
  if (finalTaskCount !== beforeTaskCount + 1) {
    throw new Error(`Expected task_count ${beforeTaskCount + 1}, got ${finalTaskCount}`);
  }
  if (finalSubmissionCount !== beforeSubmissionCount + 1) {
    throw new Error(`Expected submission_count_total ${beforeSubmissionCount + 1}, got ${finalSubmissionCount}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    contractAddress: CONTRACT_ADDRESS,
    taskId,
    submissionId,
    passed: true,
    records,
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outPath, passed: true, taskId, submissionId, totalRecords: records.length }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
