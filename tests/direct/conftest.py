import atexit
import os
import sys

import pytest


def _tolerant_unlink(path, *args, **kwargs):
    try:
        return _real_unlink(path, *args, **kwargs)
    except PermissionError:
        _leaked_files.append(path)


_leaked_files = []
_real_unlink = os.unlink

if sys.platform == "win32":
    os.unlink = _tolerant_unlink

    def _sweep_leaked_files():
        for path in _leaked_files:
            try:
                os.remove(path)
            except OSError:
                pass

    atexit.register(_sweep_leaked_files)


def warp_to(direct_vm, iso: str) -> None:
    direct_vm.warp(iso)


@pytest.fixture(autouse=True)
def _reset_known_contract():
    yield
    try:
        import genlayer.gl.genvm_contracts as gc

        gc.__known_contract__ = None
    except ImportError:
        pass
