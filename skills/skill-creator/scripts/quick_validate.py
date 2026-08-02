#!/usr/bin/env python3
"""
Quick validation script for Pi skills - supports single and batch validation

Usage:
    quick_validate.py <skill_directory>                    # Validate single skill
    quick_validate.py <dir1> <dir2> ...                   # Validate multiple skills
    quick_validate.py --scan <parent_directory>            # Scan and validate all skills in directory
    quick_validate.py --scan <dir1> --scan <dir2>          # Scan multiple directories
"""

import argparse
import re
import sys
from pathlib import Path

MAX_SKILL_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024


def validate_skill(skill_path):
    """Basic validation of a Pi skill"""
    skill_path = Path(skill_path)

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, "SKILL.md not found"

    content = skill_md.read_text()
    if not content.startswith("---"):
        return False, "No YAML frontmatter found"

    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Simple YAML parsing for frontmatter (no external dependencies)
    frontmatter = {}
    for line in frontmatter_text.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()
            # Remove quotes if present
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            # Convert boolean strings
            if value.lower() == 'true':
                value = True
            elif value.lower() == 'false':
                value = False
            frontmatter[key] = value

    # Pi allows these frontmatter fields according to the specification
    allowed_properties = {
        "name",
        "description",
        "license",
        "compatibility",
        "metadata",
        "allowed-tools",
        "disable-model-invocation",
    }

    unexpected_keys = set(frontmatter.keys()) - allowed_properties
    if unexpected_keys:
        allowed = ", ".join(sorted(allowed_properties))
        unexpected = ", ".join(sorted(unexpected_keys))
        return (
            False,
            f"Unexpected key(s) in SKILL.md frontmatter: {unexpected}. Allowed properties are: {allowed}",
        )

    if "name" not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if "description" not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    name = frontmatter.get("name", "")
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        if not re.match(r"^[a-z0-9-]+$", name):
            return (
                False,
                f"Name '{name}' should be hyphen-case (lowercase letters, digits, and hyphens only)",
            )
        if name.startswith("-") or name.endswith("-") or "--" in name:
            return (
                False,
                f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens",
            )
        if len(name) > MAX_SKILL_NAME_LENGTH:
            return (
                False,
                f"Name is too long ({len(name)} characters). "
                f"Maximum is {MAX_SKILL_NAME_LENGTH} characters.",
            )

    description = frontmatter.get("description", "")
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        if "<" in description or ">" in description:
            return False, "Description cannot contain angle brackets (< or >)"
        if len(description) > MAX_DESCRIPTION_LENGTH:
            return (
                False,
                f"Description is too long ({len(description)} characters). Maximum is {MAX_DESCRIPTION_LENGTH} characters.",
            )

    # Validate optional fields if present
    compatibility = frontmatter.get("compatibility", "")
    if compatibility and isinstance(compatibility, str):
        if len(compatibility) > 500:
            return (
                False,
                f"Compatibility is too long ({len(compatibility)} characters). Maximum is 500 characters.",
            )

    # Validate disable-model-invocation if present
    disable_model = frontmatter.get("disable-model-invocation")
    if disable_model is not None and not isinstance(disable_model, bool):
        return (
            False,
            f"disable-model-invocation must be a boolean, got {type(disable_model).__name__}",
        )

    return True, "Skill is valid!"


def find_skills_in_directory(parent_dir):
    """Find all skill directories (containing SKILL.md) in a parent directory."""
    parent_path = Path(parent_dir)
    if not parent_path.exists() or not parent_path.is_dir():
        return []
    
    skills = []
    # Check if parent itself is a skill
    if (parent_path / "SKILL.md").exists():
        skills.append(parent_path)
        return skills
    
    # Search subdirectories
    for item in sorted(parent_path.iterdir()):
        if item.is_dir() and (item / "SKILL.md").exists():
            skills.append(item)
    return skills


def validate_batch(paths, scan_dirs=None):
    """Validate multiple skills and produce a summary report."""
    all_skills = []
    
    # Process direct paths
    for path in paths:
        skill_path = Path(path)
        if skill_path.is_dir():
            if (skill_path / "SKILL.md").exists():
                all_skills.append(skill_path)
            else:
                # Check if it's a parent directory with skills
                found = find_skills_in_directory(skill_path)
                if found:
                    all_skills.extend(found)
                else:
                    print(f"[WARN] {path}: Not a skill directory (no SKILL.md found)")
    
    # Process scan directories
    if scan_dirs:
        for scan_dir in scan_dirs:
            found = find_skills_in_directory(scan_dir)
            if found:
                all_skills.extend(found)
            else:
                print(f"[WARN] {scan_dir}: No skills found")
    
    if not all_skills:
        print("[ERROR] No valid skill directories found.")
        return False
    
    # Deduplicate
    seen = set()
    unique_skills = []
    for skill in all_skills:
        resolved = skill.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique_skills.append(skill)
    
    # Validate each skill
    results = {"valid": [], "invalid": []}
    print(f"\nValidating {len(unique_skills)} skill(s)...\n")
    print("-" * 60)
    
    for skill_path in unique_skills:
        valid, message = validate_skill(skill_path)
        status = "✓ PASS" if valid else "✗ FAIL"
        name = skill_path.name
        print(f"  {status}  {name}")
        if not valid:
            print(f"         {message}")
            results["invalid"].append((skill_path, message))
        else:
            results["valid"].append(skill_path)
    
    # Summary
    print("-" * 60)
    print(f"\nSummary: {len(results['valid'])} passed, {len(results['invalid'])} failed\n")
    
    if results["invalid"]:
        print("Failed skills:")
        for path, msg in results["invalid"]:
            print(f"  - {path.name}: {msg}")
        return False
    
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Validate Pi skills - single or batch mode.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  %(prog)s ./my-skill                      # Validate single skill
  %(prog)s ./skill1 ./skill2 ./skill3      # Validate multiple skills
  %(prog)s --scan ./skills                  # Scan and validate all skills in directory
  %(prog)s --scan ~/.pi/agent/skills        # Scan global skills directory
""",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Skill directories to validate",
    )
    parser.add_argument(
        "--scan",
        action="append",
        default=[],
        help="Scan directory for skills (repeatable)",
    )
    
    args = parser.parse_args()
    
    if not args.paths and not args.scan:
        parser.print_help()
        sys.exit(1)
    
    success = validate_batch(args.paths, args.scan)
    sys.exit(0 if success else 1)