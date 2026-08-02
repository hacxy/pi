#!/usr/bin/env python3
"""
Skill Testing Framework for Pi agent - Tests skill structure and functionality

Usage:
    test_skill.py <skill_directory>                    # Run all tests
    test_skill.py <skill_directory> --test structure   # Run specific test
    test_skill.py <skill_directory> --verbose          # Verbose output
    test_skill.py --scan <parent_directory>            # Test all skills in directory

Tests:
    - structure: Validate directory structure and required files
    - frontmatter: Validate SKILL.md frontmatter
    - scripts: Test executable scripts
    - references: Check reference files exist and are readable
    - links: Verify internal links in SKILL.md
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

# Test result constants
PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"
SKIP = "SKIP"


class TestResult:
    def __init__(self, name, status, message=""):
        self.name = name
        self.status = status
        self.message = message

    def __str__(self):
        icon = {"PASS": "✓", "FAIL": "✗", "WARN": "⚠", "SKIP": "○"}[self.status]
        result = f"  {icon} {self.name}"
        if self.message:
            result += f": {self.message}"
        return result


def test_structure(skill_path):
    """Test skill directory structure."""
    results = []
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if skill_md.exists():
        results.append(TestResult("SKILL.md exists", PASS))
    else:
        results.append(TestResult("SKILL.md exists", FAIL, "File not found"))
        return results  # Can't continue without SKILL.md

    # Check for optional directories
    for dirname in ["scripts", "references", "assets"]:
        dir_path = skill_path / dirname
        if dir_path.exists():
            if dir_path.is_dir():
                file_count = len(list(dir_path.iterdir()))
                results.append(TestResult(
                    f"{dirname}/ directory",
                    PASS,
                    f"{file_count} file(s)" if file_count > 0 else "empty"
                ))
            else:
                results.append(TestResult(
                    f"{dirname}/ directory",
                    FAIL,
                    "Exists but is not a directory"
                ))

    # Check for unexpected files at root
    unexpected = []
    for item in skill_path.iterdir():
        if item.name.startswith("."):
            continue  # Skip hidden files
        if item.name == "SKILL.md":
            continue
        if item.name in ["scripts", "references", "assets"]:
            continue
        if item.name == "README.md":
            unexpected.append(item.name)
        else:
            unexpected.append(item.name)

    if unexpected:
        results.append(TestResult(
            "Root directory cleanliness",
            WARN,
            f"Unexpected files: {', '.join(unexpected)}"
        ))
    else:
        results.append(TestResult("Root directory cleanliness", PASS))

    return results


def test_frontmatter(skill_path):
    """Test SKILL.md frontmatter."""
    results = []
    skill_md = Path(skill_path) / "SKILL.md"

    if not skill_md.exists():
        results.append(TestResult("Frontmatter", FAIL, "SKILL.md not found"))
        return results

    content = skill_md.read_text()

    # Check frontmatter exists
    if not content.startswith("---"):
        results.append(TestResult("Frontmatter exists", FAIL, "No YAML frontmatter found"))
        return results

    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        results.append(TestResult("Frontmatter format", FAIL, "Invalid frontmatter format"))
        return results

    results.append(TestResult("Frontmatter format", PASS))
    frontmatter_text = match.group(1)

    # Parse frontmatter
    frontmatter = {}
    for line in frontmatter_text.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            if value.lower() == 'true':
                value = True
            elif value.lower() == 'false':
                value = False
            frontmatter[key] = value

    # Check required fields
    if "name" in frontmatter:
        name = frontmatter["name"]
        if isinstance(name, str) and re.match(r"^[a-z0-9-]+$", name):
            if len(name) <= 64:
                results.append(TestResult("Name field", PASS, f"'{name}'"))
            else:
                results.append(TestResult("Name field", FAIL, f"Too long ({len(name)} chars)"))
        else:
            results.append(TestResult("Name field", FAIL, f"Invalid format: '{name}'"))
    else:
        results.append(TestResult("Name field", FAIL, "Missing 'name'"))

    if "description" in frontmatter:
        desc = frontmatter["description"]
        if isinstance(desc, str):
            if len(desc) <= 1024:
                results.append(TestResult("Description field", PASS, f"{len(desc)} chars"))
            else:
                results.append(TestResult("Description field", FAIL, f"Too long ({len(desc)} chars)"))
        else:
            results.append(TestResult("Description field", FAIL, "Must be a string"))
    else:
        results.append(TestResult("Description field", FAIL, "Missing 'description'"))

    # Check optional fields
    optional_fields = ["license", "compatibility", "metadata", "allowed-tools", "disable-model-invocation"]
    for field in optional_fields:
        if field in frontmatter:
            results.append(TestResult(f"Optional '{field}'", PASS, "Present"))

    return results


def test_scripts(skill_path):
    """Test executable scripts in the skill."""
    results = []
    scripts_dir = Path(skill_path) / "scripts"

    if not scripts_dir.exists():
        results.append(TestResult("Scripts", SKIP, "No scripts directory"))
        return results

    scripts = list(scripts_dir.glob("*.py")) + list(scripts_dir.glob("*.sh"))
    if not scripts:
        results.append(TestResult("Scripts", SKIP, "No scripts found"))
        return results

    for script in scripts:
        # Check if Python scripts have valid syntax
        if script.suffix == ".py":
            try:
                result = subprocess.run(
                    [sys.executable, "-m", "py_compile", str(script)],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    results.append(TestResult(f"Script {script.name}", PASS, "Valid syntax"))
                else:
                    results.append(TestResult(
                        f"Script {script.name}",
                        FAIL,
                        f"Syntax error: {result.stderr.strip()[:100]}"
                    ))
            except subprocess.TimeoutExpired:
                results.append(TestResult(f"Script {script.name}", WARN, "Compilation timeout"))
            except Exception as e:
                results.append(TestResult(f"Script {script.name}", WARN, str(e)[:100]))

        # Check if shell scripts are executable
        elif script.suffix == ".sh":
            if script.stat().st_mode & 0o111:
                results.append(TestResult(f"Script {script.name}", PASS, "Executable"))
            else:
                results.append(TestResult(f"Script {script.name}", WARN, "Not executable"))

    return results


def test_references(skill_path):
    """Test reference files in the skill."""
    results = []
    refs_dir = Path(skill_path) / "references"

    if not refs_dir.exists():
        results.append(TestResult("References", SKIP, "No references directory"))
        return results

    refs = list(refs_dir.glob("*.md"))
    if not refs:
        results.append(TestResult("References", SKIP, "No reference files found"))
        return results

    for ref in refs:
        try:
            content = ref.read_text()
            if len(content) > 0:
                results.append(TestResult(
                    f"Reference {ref.name}",
                    PASS,
                    f"{len(content)} chars"
                ))
            else:
                results.append(TestResult(f"Reference {ref.name}", WARN, "Empty file"))
        except Exception as e:
            results.append(TestResult(f"Reference {ref.name}", FAIL, str(e)[:100]))

    return results


def test_links(skill_path):
    """Test internal links in SKILL.md."""
    results = []
    skill_md = Path(skill_path) / "SKILL.md"

    if not skill_md.exists():
        results.append(TestResult("Internal links", SKIP, "SKILL.md not found"))
        return results

    content = skill_md.read_text()

    # Remove code blocks before checking links
    # This prevents checking example links inside code blocks
    code_block_pattern = r'```[\s\S]*?```'
    content_without_code = re.sub(code_block_pattern, '', content)
    
    # Also remove inline code
    inline_code_pattern = r'`[^`]+`'
    content_without_code = re.sub(inline_code_pattern, '', content_without_code)

    # Find markdown links [text](path)
    link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    links = re.findall(link_pattern, content_without_code)

    if not links:
        results.append(TestResult("Internal links", SKIP, "No links found (or all in code blocks)"))
        return results

    broken_links = []
    for text, path in links:
        # Skip external URLs
        if path.startswith(("http://", "https://", "#")):
            continue

        # Resolve relative path
        link_path = Path(skill_path) / path
        if not link_path.exists():
            broken_links.append(f"{text} -> {path}")

    if broken_links:
        results.append(TestResult(
            "Internal links",
            FAIL,
            f"Broken: {', '.join(broken_links[:3])}"
        ))
    else:
        results.append(TestResult("Internal links", PASS, f"{len(links)} link(s) checked"))

    return results


def run_all_tests(skill_path, verbose=False):
    """Run all tests on a skill."""
    print(f"\n{'=' * 60}")
    print(f"Testing: {Path(skill_path).name}")
    print(f"Path: {skill_path}")
    print(f"{'=' * 60}\n")

    all_results = []

    test_functions = [
        ("Structure", test_structure),
        ("Frontmatter", test_frontmatter),
        ("Scripts", test_scripts),
        ("References", test_references),
        ("Links", test_links),
    ]

    for test_name, test_func in test_functions:
        if verbose:
            print(f"\n--- {test_name} ---")
        results = test_func(skill_path)
        all_results.extend(results)

        if verbose:
            for result in results:
                print(result)

    # Summary
    pass_count = sum(1 for r in all_results if r.status == PASS)
    fail_count = sum(1 for r in all_results if r.status == FAIL)
    warn_count = sum(1 for r in all_results if r.status == WARN)
    skip_count = sum(1 for r in all_results if r.status == SKIP)

    print(f"\n{'-' * 60}")
    print(f"Summary: {pass_count} passed, {fail_count} failed, {warn_count} warnings, {skip_count} skipped")

    if fail_count > 0:
        print("\nFailed tests:")
        for r in all_results:
            if r.status == FAIL:
                print(f"  - {r.name}: {r.message}")

    return fail_count == 0


def find_skills_in_directory(parent_dir):
    """Find all skill directories in a parent directory."""
    parent_path = Path(parent_dir)
    if not parent_path.exists() or not parent_path.is_dir():
        return []

    skills = []
    if (parent_path / "SKILL.md").exists():
        skills.append(parent_path)
        return skills

    for item in sorted(parent_path.iterdir()):
        if item.is_dir() and (item / "SKILL.md").exists():
            skills.append(item)
    return skills


def main():
    parser = argparse.ArgumentParser(
        description="Test Pi skills - structure, frontmatter, scripts, references, and links.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  %(prog)s ./my-skill                      # Run all tests
  %(prog)s ./my-skill --test structure      # Run specific test
  %(prog)s ./my-skill --verbose             # Verbose output
  %(prog)s --scan ./skills                  # Test all skills in directory
""",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Skill directories to test",
    )
    parser.add_argument(
        "--scan",
        action="append",
        default=[],
        help="Scan directory for skills (repeatable)",
    )
    parser.add_argument(
        "--test",
        choices=["structure", "frontmatter", "scripts", "references", "links"],
        help="Run specific test only",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output",
    )

    args = parser.parse_args()

    if not args.paths and not args.scan:
        parser.print_help()
        sys.exit(1)

    # Collect all skills to test
    all_skills = []

    for path in args.paths or []:
        skill_path = Path(path)
        if skill_path.is_dir():
            if (skill_path / "SKILL.md").exists():
                all_skills.append(skill_path)
            else:
                found = find_skills_in_directory(skill_path)
                if found:
                    all_skills.extend(found)
                else:
                    print(f"[WARN] {path}: Not a skill directory")

    for scan_dir in args.scan:
        found = find_skills_in_directory(scan_dir)
        if found:
            all_skills.extend(found)
        else:
            print(f"[WARN] {scan_dir}: No skills found")

    if not all_skills:
        print("[ERROR] No valid skill directories found.")
        sys.exit(1)

    # Deduplicate
    seen = set()
    unique_skills = []
    for skill in all_skills:
        resolved = skill.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique_skills.append(skill)

    # Run tests
    print(f"\nFound {len(unique_skills)} skill(s) to test")
    passed = 0
    failed = 0

    for skill_path in unique_skills:
        success = run_all_tests(skill_path, args.verbose)
        if success:
            passed += 1
        else:
            failed += 1

    # Final summary
    print(f"\n{'=' * 60}")
    print(f"Final: {passed} skills passed, {failed} skills failed")
    print(f"{'=' * 60}\n")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()