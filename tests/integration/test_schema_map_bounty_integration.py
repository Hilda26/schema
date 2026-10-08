import pytest

pytestmark = pytest.mark.integration


def test_deployed_schema_exposes_schema_map_bounty_surface(deployed_contract):
    assert int(deployed_contract.task_count(args=[]).call()) >= 0
    assert int(deployed_contract.submission_count_total(args=[]).call()) >= 0
