# SchemaMapBounty

SchemaMapBounty is a GenLayer Intelligent Contract for reusable semantic data
onboarding. A sponsor escrows a reward for the first mapping specification that
correctly transforms a declared source profile into a target schema under a
fixed quality rubric.

## Why this needs GenLayer

Schema mapping is often semantic rather than deterministic. Validators may need
to decide whether `ltv_cents` really maps to `lifetime_value_usd`, whether a
timestamp-to-date transform preserves the intended meaning, or whether a mapper
quietly dropped a required target field. The contract keeps money movement
deterministic while GenLayer consensus handles the meaning-based judgment.

## Review-conscious design

- The judged output is only a finite `accepted` boolean plus finite
  `reason_code`; the model never chooses an address or amount.
- Payout always uses the stored mapper and escrowed reward.
- After the refund deadline, `review_mapping` is blocked and the only successful
  path is sponsor refund through `cancel_expired_task`.
- Source profile, target schema, rubric, evidence commitment, and mapping
  candidate are JSON-encoded as evidence-only data.
- Malformed or inconsistent verdicts mark only the submission as `ERRORED`, so a
  transient bad round does not lock the task.
- Settlement revalidates task and submission state after the judged round.

## Main methods

- `create_task(source_profile_json, target_schema_json, quality_rubric_json, evidence_commitment, reward, submit_window_seconds, refund_grace_seconds)`
- `submit_mapping(task_id, mapping_json)`
- `review_mapping(submission_id)`
- `cancel_expired_task(task_id)`
- `get_task(task_id)`
- `get_submission(submission_id)`
- `list_submissions_for_task(task_id)`

## Verification

```powershell
genvm-lint check contracts\schema_map_bounty.py --json
pytest tests\direct\ -v
```

Current local result:

- GenVM lint: passed.
- Direct tests: 16 passed.
- StudioNet integration smoke test: 1 passed.

## Deployment

- StudioNet contract address: `0xF7E17581A1A281a697b45894dff8F71dda8B1A8b`
- Deployment transaction: `0x7e05e84c0d540a3541ed09594caff2dfdbf84419bf27347403cbcc8a8c9a327d`
- Deployment receipt: `FINALIZED`, `MAJORITY_AGREE`, leader execution `SUCCESS`,
  `stderr=""`, `raw_error=null`.
- `genlayer schema 0xF7E17581A1A281a697b45894dff8F71dda8B1A8b` succeeded.
- `genlayer call 0xF7E17581A1A281a697b45894dff8F71dda8B1A8b task_count`
  returned `0`.
- `genlayer call 0xF7E17581A1A281a697b45894dff8F71dda8B1A8b submission_count_total`
  returned `0`.

## Live StudioNet Test

A real lifecycle test was also run against the deployed contract:

- `create_task`: `0x26cd56cf1ba4e71b11a37df78884a113559cf9746039e565e4a87ff4a9307b8e`
- `submit_mapping`: `0xafe131a18389cbfb3386444d91b622d0b1dd9a470a833b72d4366bd8494ec639`
- `review_mapping`: `0xa67ed474f96cfa70c1a3fcca1b881defb0593c775ada676efaccead94499c0c5`

Final state: task `0` is `AWARDED`, submission `0` is `ACCEPTED`, and the
decision code is `MAPPING_ACCEPTED`.
