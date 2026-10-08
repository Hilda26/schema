# SchemaMapBounty Design Notes

## Core Flow

1. The sponsor creates a mapping task and escrows the full reward.
2. The sponsor publishes a source profile, target schema, quality rubric, and
   evidence commitment.
3. Mappers submit JSON mapping specifications.
4. Anyone may review a pending or errored submission before the refund deadline.
5. GenLayer validators decide whether the mapping satisfies the fixed rubric.
6. Accepted mappings pay the stored mapper and terminally award the task.
7. Rejected mappings leave the task open for other submissions.
8. After the refund deadline, review is blocked and anyone may trigger sponsor
   refund.

## Equivalence Principle

Validators compare only:

```json
{"accepted": true, "reason_code": "MAPPING_ACCEPTED"}
```

or:

```json
{"accepted": false, "reason_code": "<finite rejection code>"}
```

Allowed rejection codes are `MISSING_REQUIRED_FIELD`, `SEMANTIC_MISMATCH`,
`UNSUPPORTED_TRANSFORM`, `AMBIGUOUS_MAPPING`, and `MALFORMED_MAPPING`.

## Consequence Boundary

The model cannot set a recipient, amount, task id, or submission id. A successful
accepted verdict pays `submission.mapper` exactly `task.reward`. Refunds always
pay `task.sponsor`.

## Reusability

The contract can be reused for CRM migrations, ETL onboarding, analytics event
normalization, healthcare code mapping, vendor CSV imports, or any workflow
where a sponsor can publish a non-secret schema task and wants validators to
agree on semantic mapping quality.
