# SchemaEvolutionRegistry design

## Distinct mechanism

The earlier SchemaMapBounty used a generic first-accepted bounty lifecycle. This
contract replaces that mechanism rather than relabeling it.

| Earlier mechanism | SchemaEvolutionRegistry |
| --- | --- |
| Sponsor escrows a reward | No value enters the contract |
| Multiple mapper submissions compete | Registry owner publishes immutable versions |
| First accepted submission wins | Analysis creates a compatibility edge |
| Winner receives escrow | No winner or transfer exists |
| Expiry refunds sponsor | No expiry or refund exists |
| Task/submission storage | Registry/version compatibility graph |
| Terminal `AWARDED` task | Evolving active-version head |

The new reusable output is durable schema-governance state: which version is
active, how it relates to its predecessor, whether a migration is required, and
whether that migration plan is adequate.

## Deterministic state machine

The registry begins with an active genesis version. Each proposed version fixes:

- its active predecessor;
- schema JSON and external content commitment;
- the registry's immutable compatibility-policy snapshot;
- its migration plan; and
- the earliest deterministic activation time.

Analysis can move a version from `DRAFT` or `ERRORED` to:

- `ANALYZED` for compatible changes;
- `ANALYZED` for breaking changes with an adequate migration plan;
- `BLOCKED` for ambiguous changes or inadequate breaking migrations; or
- `ERRORED` for malformed/inconsistent comparative output.

Only `ANALYZED` can become `ACTIVE`. Activation deterministically deprecates the
recorded predecessor and advances `current_version_id`. Parallel proposals do
not silently rebase: after another branch activates, they become ineligible and
can be marked `STALE`.

## Consensus boundary

Validators answer one semantic question about two fixed schemas and one fixed
migration plan. The exact output contains only:

```json
{
  "classification": "BREAKING",
  "migration_assessment": "ADEQUATE",
  "reason_code": "TYPE_OR_FORMAT_CHANGED"
}
```

The contract validates both finite membership and cross-field coherence. For
example, a `BREAKING` classification cannot use `NOT_REQUIRED`, while
`AMBIGUOUS` must use `NOT_APPLICABLE` and `AMBIGUOUS_CHANGE`.

Consensus cannot choose an owner, version id, predecessor, activation time, or
state transition. Extra fields are invalid. Model failures create a retryable
`ERRORED` version without changing the registry head.

## Time and stale rounds

No leader/model timestamp exists. `analyzed_at`, `activate_after`, activation,
deprecation, and freezing all use GenVM's validator-reproduced transaction time.
The analysis round snapshots registry state, the current head, and proposal
status. If any changes before settlement, the stale round is a no-op.

## Immutability and branches

Schema contents, commitments, policies, migration plans, and predecessor links
cannot be edited after proposal. A corrected change is a new version, leaving a
complete audit trail. Activating one of several proposals makes the others stale
instead of applying an analysis to a different predecessor.

## Bounded growth

Inputs are length-bounded, activation delays are bounded, and a registry stores
at most 64 versions. This keeps list operations finite and makes storage growth
explicit.

## No economic lifecycle

The contract has no `payable` decorator, reads no message value, and emits no
transfer. There is no sponsor, mapper, submission reward, accepted winner,
deadline refund, or financial settlement. Its substantive mechanism is semantic
version governance and compatibility-graph maintenance.
