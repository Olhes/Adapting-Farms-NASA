"""Every text file the project opens must say its encoding, or the suites break under the Windows default (cp1252)."""
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT_METHODS = {"read_text", "write_text"}


def _python_files():
    for base in (ROOT / "model", ROOT / "backend" / "app"):
        yield from (p for p in base.rglob("*.py") if "tests" not in p.parts)


def _mode(call):
    mode = call.args[1] if len(call.args) > 1 else next((k.value for k in call.keywords if k.arg == "mode"), None)
    return mode.value if isinstance(mode, ast.Constant) and isinstance(mode.value, str) else "r"


def _missing_encoding():
    bad = []
    for path in _python_files():
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"), filename=str(path))):
            if not isinstance(node, ast.Call):
                continue
            is_open = isinstance(node.func, ast.Name) and node.func.id == "open" and "b" not in _mode(node)
            is_path_io = isinstance(node.func, ast.Attribute) and node.func.attr in TEXT_METHODS
            if (is_open or is_path_io) and not any(k.arg == "encoding" for k in node.keywords):
                bad.append(f"{path.relative_to(ROOT)}:{node.lineno}")
    return bad


def test_every_text_open_declares_its_encoding():
    assert _missing_encoding() == []
