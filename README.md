# SchemaEvolutionRegistry

SchemaEvolutionRegistry is a reusable GenLayer Intelligent Contract for
governing semantic schema upgrades. It maintains immutable schema versions and
an on-chain compatibility graph. GenLayer validators classify each proposed
version against its active predecessor and decide whether a breaking change has
an adequate migration plan.

This is not a bounty or escrow contract. It has no payable method, submission
competition, winner, payout, expiry refund, or transfer path.

## Why this needs GenLayer

Many schema changes cannot be classified safely through JSON shape comparison
alone. Renaming a field may preserve or change meaning; changing a timestamp
format may break consumers even when the primitive type stays `string`; adding
a required field may be safe only if the migration plan supplies a deterministic
backfill. Validators judge those semantic relationships under the registry's
immutable compatibility policy.

Deterministic contract code owns everything that must not be model-controlled:

- registry ownership and freezing;
- immutable version contents and commitments;
- predecessor links and version ordering;
- activation delays and timestamps;
- current-version selection and predecessor deprecation;
- stale parallel branches; and
- the compatibility graph exposed to downstream integrators.

## Lifecycle

1. An owner creates a registry with an immediately active genesis schema and an
   immutable compatibility policy.
2. The owner proposes an immutable version linked to the current active version.
3. Anyone may request semantic compatibility analysis.
4. Validators return exactly `classification`, `migration_assessment`, and
   `reason_code`.
5. Compatible versions become `ANALYZED`. Breaking versions do so only when the
   migration plan is `ADEQUATE`.
6. Ambiguous changes and breaking changes with inadequate migration plans become
   terminally `BLOCKED`.
7. After the deterministic activation delay, the owner may activate an analyzed
   version. Its predecessor becomes `DEPRECATED` and the graph head advances.
8. Competing proposals linked to the old head can be marked `STALE`.
9. The owner may permanently `FROZEN` the registry to stop further evolution.

## Compatibility output

The comparative result must contain exactly:

```json
{
  "classification": "BACKWARD_COMPATIBLE",
  "migration_assessment": "NOT_REQUIRED",
  "reason_code": "OPTIONAL_ADDITION"
}
```

Classifications are `FULLY_COMPATIBLE`, `BACKWARD_COMPATIBLE`,
`FORWARD_COMPATIBLE`, `BREAKING`, or `AMBIGUOUS`.

Breaking changes require `ADEQUATE` or `INADEQUATE`. Compatible changes require
`NOT_REQUIRED`, and ambiguous changes require `NOT_APPLICABLE`. Exact parsing
rejects extra fields, including timestamps. All analysis and activation times
come from GenVM's deterministic transaction timestamp outside nondeterministic
execution.

## Public methods

- `create_registry(namespace, genesis_schema_json, genesis_commitment, compatibility_policy_json)`
- `propose_version(registry_id, schema_json, schema_commitment, migration_plan_json, activation_delay_seconds)`
- `analyze_version(version_id)`
- `activate_version(version_id)`
- `mark_stale_version(version_id)`
- `freeze_registry(registry_id)`
- `get_registry(registry_id)`
- `get_version(version_id)`
- `get_compatibility(from_version_id, to_version_id)`
- `list_versions(registry_id)`
- `can_activate(version_id)`
- `registry_count()`
- `version_count_total()`

## Reusable integrations

API gateways, event buses, data warehouses, healthcare interfaces, analytics
pipelines, smart-contract indexers, and agent tool registries can query the
active version and compatibility edges before accepting an upgrade. The graph
provides durable semantic upgrade metadata rather than selecting a winning
submission.

## Verification

```powershell
genvm-lint check contracts\schema_map_bounty.py --json
pytest -q
```

Current local result:

- GenVM lint and schema validation: passed (`13` methods: `6` write, `7` view).
- Direct tests: `18 passed`.
- No public method is payable and the contract contains no transfer operation.

## StudioNet deployment

- Contract: `0xf77d7B9E85444C1c8b4c08788760bE7951E9f846`
- Explorer: `https://explorer-studio.genlayer.com/address/0xf77d7B9E85444C1c8b4c08788760bE7951E9f846`
- Deployment transaction: `0x5bebb75f3699d62dc9beb992b8968789c823bef9f61d05bec3f585cd10073e76`
- Result: `ACCEPTED / MAJORITY_AGREE`, leader `SUCCESS`.
- Deployed source matches the repository source byte-for-byte.

The live lifecycle activated a `BACKWARD_COMPATIBLE` optional-field upgrade and
blocked a `BREAKING` type change whose migration plan was `INADEQUATE`. See
`LIVE_TESTS.md` and `live-studionet-latest.json` for transaction and state
evidence.
