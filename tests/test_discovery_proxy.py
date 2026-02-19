"""Route root-level unittest discovery to the backend test suite."""


def load_tests(loader, tests, pattern):
    del tests
    return loader.discover("api/tests", pattern=pattern or "test*.py", top_level_dir=".")
