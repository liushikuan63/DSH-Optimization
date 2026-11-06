"""Read-only, bounded audit of explicit local skill references (Python stdlib)."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit


LINK = re.compile(r"\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+\"[^\"]*\")?\s*\)")
INLINE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")
FENCE = re.compile(r"^\s*(?:[-+*]\s+)?(`{3,}|~{3,})(.*)$")
MAX_PAGES = 200
MAX_BYTES = 2 * 1024 * 1024


def local_target(raw):
    value = raw.strip().removeprefix("<").removesuffix(">")
    if not value or any(c in value for c in "<>{}*|\n\r"):
        return None
    parts = urlsplit(value)
    if parts.scheme or parts.netloc or not parts.path or value.startswith(("/", "\\", "~")):
        return None
    return unquote(parts.path).replace("\\", "/")


def references(body):
    fence = None
    for number, line in enumerate(body.splitlines(), 1):
        marker = FENCE.match(line)
        if marker:
            run, rest = marker.groups()
            if fence is None:
                fence = run
            elif run[0] == fence[0] and len(run) >= len(fence) and not rest.strip():
                fence = None
            continue
        if fence is not None:
            continue
        found = set()
        inline_matches = list(INLINE.finditer(line))
        for match in LINK.finditer(line):
            if any(code.start() <= match.start() < code.end() for code in inline_matches):
                continue
            target = local_target(match.group(1))
            if target:
                found.add((target, "link"))
        for match in inline_matches:
            value = match.group(1)
            if not re.match(r"^(?:\./)?(?:scripts|references|assets)/", value):
                continue
            if any(c.isspace() for c in value) or not Path(value).suffix:
                continue
            target = local_target(value)
            if target:
                found.add((target, "inline"))
        for target, kind in sorted(found):
            yield number, target, kind


def audit(directory):
    root = Path(directory).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Expected an explicit skill directory")
    entry = root / "SKILL.md"
    if not entry.is_file():
        raise ValueError("SKILL.md is missing")
    pending, seen, items = [entry], set(), []
    while pending:
        page = pending.pop().resolve(strict=True)
        if page in seen:
            continue
        if not page.is_relative_to(root):
            raise ValueError("Entrypoint resolves outside skill directory")
        if len(seen) >= MAX_PAGES or page.stat().st_size > MAX_BYTES:
            raise ValueError("Audit limit exceeded; narrow or inspect the skill manually")
        seen.add(page)
        body = page.read_text(encoding="utf-8-sig")
        for number, target, kind in references(body):
            base = page.parent if kind == "link" else root
            destination = (base / target).resolve()
            outside = not destination.is_relative_to(root)
            exists = destination.is_file()
            items.append({"source": str(page), "line": number, "reference": target,
                          "resolved": str(destination), "exists": exists, "outside_skill": outside})
            if exists and not outside and destination.suffix.lower() == ".md":
                pending.append(destination)
    return {"skill": str(root), "pages_checked": len(seen), "references": items,
            "missing": sum(not x["exists"] for x in items),
            "outside_skill": sum(x["outside_skill"] for x in items)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directories", nargs="+", help="Explicit skill directories, not collection roots")
    args = parser.parse_args()
    reports, errors = [], []
    for directory in args.directories:
        try:
            reports.append(audit(directory))
        except (OSError, ValueError, UnicodeError, RuntimeError) as error:
            errors.append({"skill": directory, "error": str(error)})
    result = {"reports": reports, "errors": errors,
              "coverage": "Explicit inline links and file paths outside fenced blocks; existence only"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if errors else 1 if any(x["missing"] for x in reports) else 0


if __name__ == "__main__":
    raise SystemExit(main())
