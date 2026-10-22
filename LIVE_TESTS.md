# Live StudioNet evidence

The substantively redesigned SchemaEvolutionRegistry was deployed and exercised
on GenLayer StudioNet on October 22, 2026.

## Contract

- Address: `0xf77d7B9E85444C1c8b4c08788760bE7951E9f846`
- Explorer: `https://explorer-studio.genlayer.com/address/0xf77d7B9E85444C1c8b4c08788760bE7951E9f846`
- Deployment transaction: `0x5bebb75f3699d62dc9beb992b8968789c823bef9f61d05bec3f585cd10073e76`
- Source SHA-256: `b52aa2ab15d1ad607e6b80d149a46c9a692f520b873501038ab5248dc041019a`

The deployment returned `ACCEPTED / MAJORITY_AGREE`, leader execution
`SUCCESS`, empty stdout/stderr, and no raw error. A `gen_getContractCode` read
confirmed the deployed source is byte-for-byte identical to the repository
contract at implementation commit `75e03db`.

Live schema retrieval exposed all 13 expected methods: six non-payable writes
and seven views. There is no payable method.

## Command

```powershell
node live_studionet_schema_tests.mjs `
  --contract 0xf77d7B9E85444C1c8b4c08788760bE7951E9f846 `
  --out live-studionet-latest.json
```

## Transactions

| Action | Transaction |
| --- | --- |
| Create registry with active genesis | `0xcaafdc2f56d3c46478279dcec1515f8900ac6a2e27e7d0fb77583f54d689f09e` |
| Propose compatible version | `0xb0899ddc47d2b23fb43f1a9ffd1e6bdd58829e683bcc7e95619be8b3122614d5` |
| Analyze compatible version | `0x174b92d517eca10ef738c1a6afe56d3833cc3ee28f9db7235ec422d333b0409b` |
| Activate compatible version | `0xb4b7c112fa7f98c05dfa691839371b5bf807948f50dc539c8a7681d8f0418086` |
| Propose breaking version | `0x97d91ed6ccc2b356cbcf70dfeebbda7eb3633c2e53f102a78f1aa81054493a7b` |
| Analyze breaking version | `0x4f615d887b51d78381829cc0939387626dee860f60040039b88b2aff55a33b5f` |

Every receipt returned `ACCEPTED / MAJORITY_AGREE`, successful leader
execution, empty stdout/stderr, and no raw error.

## Validator outputs and final state

Compatible analysis returned exactly:

```json
{"classification":"BACKWARD_COMPATIBLE","migration_assessment":"NOT_REQUIRED","reason_code":"OPTIONAL_ADDITION"}
```

Breaking analysis returned exactly:

```json
{"classification":"BREAKING","migration_assessment":"INADEQUATE","reason_code":"TYPE_OR_FORMAT_CHANGED"}
```

Final state:

- Registry `0` remained `ACTIVE` with version `1` as its current head.
- Genesis version `0` became `DEPRECATED` only when version `1` activated.
- Version `1` became `ACTIVE` after the stored activation delay.
- Version `2` became `BLOCKED`; it could not replace the active schema.
- Two durable compatibility edges were queryable on-chain.
- Counts ended at one registry and three versions.
- No funds entered or left the contract.

The complete receipt and state record is in `live-studionet-latest.json`.
