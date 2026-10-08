# Live StudioNet Test Evidence

Live lifecycle tests were run against the deployed SchemaMapBounty contract on
October 8, 2026.

## Contract

- Address: `0xF7E17581A1A281a697b45894dff8F71dda8B1A8b`
- Explorer: `https://studio.genlayer.com/explorer/contracts/0xF7E17581A1A281a697b45894dff8F71dda8B1A8b`

## Command

```powershell
node live_studionet_schema_tests.mjs --out C:\contracts\schema-live-studionet-latest.json
```

## Real Transactions

- `create_task`: `0x26cd56cf1ba4e71b11a37df78884a113559cf9746039e565e4a87ff4a9307b8e`
- `submit_mapping`: `0xafe131a18389cbfb3386444d91b622d0b1dd9a470a833b72d4366bd8494ec639`
- `review_mapping`: `0xa67ed474f96cfa70c1a3fcca1b881defb0593c775ada676efaccead94499c0c5`

Every transaction receipt returned:

- `statusName`: `ACCEPTED`
- `resultName`: `MAJORITY_AGREE`
- Leader execution: `SUCCESS`
- `stdout`: empty
- `stderr`: empty
- `rawError`: `null`

## Final On-Chain State

- `taskId`: `0`
- `submissionId`: `0`
- Final task state: `AWARDED`
- Winner: `0xD2674bc0A4F386EF71E874413D8f172608d76cCe`
- Decision code: `MAPPING_ACCEPTED`
- Final submission status: `ACCEPTED`
- Final `task_count`: `1`
- Final `submission_count_total`: `1`

