import pytest

pytestmark = pytest.mark.integration


def test_deployed_schema_exposes_schema_evolution_registry_surface(deployed_contract):
    assert int(deployed_contract.registry_count(args=[]).call()) >= 0
    assert int(deployed_contract.version_count_total(args=[]).call()) >= 0
