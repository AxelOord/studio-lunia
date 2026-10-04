#!/usr/bin/env python3
"""Small offline spec scaffolder and structural checker (Python 3.10+)."""
import argparse
from collections import Counter
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ('requirements-first', 'design-first', 'bugfix')
REF = r'\b[RP]-[1-9]\d*\b'
PLACEHOLDER = re.compile(r'\b(?:TODO|TBD)\b|\{\{.*?\}\}')


def slug(value):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value) or len(value) > 64:
        raise argparse.ArgumentTypeError('Use 1–64 lowercase letters/digits with single hyphens.')
    return value


def no_symlinks(path, root):
    if not path.is_relative_to(root) or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Path must stay inside the repository.')
    for part in (path, *path.parents):
        if part == root:
            break
        if part.is_symlink():
            raise ValueError(f'Symlink paths are not supported: {part}')


def new_spec(root, project, spec, workflow):
    slug(project)
    slug(spec)
    if workflow not in WORKFLOWS:
        raise ValueError('Unknown workflow')
    project_dir = root
    target = project_dir / 'specs' / spec
    no_symlinks(target, root)
    if target.exists():
        raise ValueError(f'Refusing to overwrite existing spec: {target}')
    values = {'project': project, 'spec': spec, 'workflow': workflow,
              'preservation': 'P-1: TODO: how existing behavior is preserved.' if workflow == 'bugfix' else '',
              'refs': 'R-1, P-1' if workflow == 'bugfix' else 'R-1',
              'task': 'Reproduce, repair and verify preservation' if workflow == 'bugfix' else 'Build and verify the smallest step'}
    def render(name):
        text = (root / 'templates' / name).read_text(encoding='utf-8')
        for key, value in values.items():
            text = text.replace('{{' + key + '}}', value)
        return text
    # Read every template before writing anything; never replace existing content.
    docs = {name: render('spec/' + ('bugfix-requirements.md' if name == 'requirements.md' and workflow == 'bugfix' else name))
            for name in ('requirements.md', 'design.md', 'tasks.md')}
    profile = {}
    target.mkdir(parents=True, exist_ok=False)
    for name, content in docs.items():
        (target / name).write_text(content, encoding='utf-8')
    for name, content in profile.items():
        path = project_dir / name
        if not path.exists() and not path.is_symlink():
            with path.open('x', encoding='utf-8') as handle:
                handle.write(content)
    return target


def check_spec(path, ready=False):
    errors = []
    docs = {}
    for name in ('requirements.md', 'design.md', 'tasks.md'):
        file = path / name
        if not file.is_file():
            errors.append(f'Missing {name}')
        else:
            docs[name] = file.read_text(encoding='utf-8')
    if errors:
        return errors
    req, design, tasks = (docs[n] for n in ('requirements.md', 'design.md', 'tasks.md'))
    workflow = re.findall(r'^Workflow: (.+)$', req, re.M)
    status = re.findall(r'^Status: (.+)$', req, re.M)
    if len(workflow) != 1 or workflow[0] not in WORKFLOWS:
        errors.append('Expected one valid Workflow field')
    if len(status) != 1 or status[0] not in ('draft', 'ready', 'done'):
        errors.append('Expected one Status: draft, ready or done')
    strict = ready or status in (['ready'], ['done'])
    if ready and status == ['draft']:
        errors.append('Draft is not ready')
    if strict:
        for name, text in docs.items():
            if PLACEHOLDER.search(text):
                errors.append(f'{name}: unresolved placeholder')
    requirements = list(re.finditer(r'^### ([RP]-[1-9]\d*): (.+)$', req, re.M))
    ids = [m[1] for m in requirements]
    known = set(ids)
    if not requirements:
        errors.append('No requirement headings (### R-1: …)')
    for ident, count in Counter(ids).items():
        if count > 1:
            errors.append(f'Duplicate requirement {ident}')
    for i, match in enumerate(requirements):
        end = requirements[i+1].start() if i+1 < len(requirements) else len(req)
        block = req[match.end():end].split('\n## ', 1)[0]
        if not re.search(r'^Check: \S.+', block, re.M):
            errors.append(f'{match[1]}: missing Check')
        if not any(line.strip() and not line.startswith('Check:') for line in block.splitlines()):
            errors.append(f'{match[1]}: missing acceptance criterion')
    if workflow == ['bugfix'] and not any(x.startswith('P-') for x in ids):
        errors.append('Bugfix needs a preservation requirement P-…')
    design_refs = set(re.findall(REF, design))
    for ident in sorted(known - design_refs):
        errors.append(f'{ident}: missing from design')
    for ident in sorted(design_refs - known):
        errors.append(f'Design references unknown {ident}')
    task_matches = list(re.finditer(r'^- \[([ xX])\] (T-[1-9]\d*): (.+)$', tasks, re.M))
    if not task_matches:
        errors.append('No task entries (- [ ] T-1: …)')
    seen, covered = set(), set()
    for i, match in enumerate(task_matches):
        ident = match[2]
        if ident in seen:
            errors.append(f'Duplicate task {ident}')
        end = task_matches[i+1].start() if i+1 < len(task_matches) else len(tasks)
        block = tasks[match.end():end]
        fields = {}
        for name in ('Refs', 'Depends', 'Verify', 'Evidence'):
            found = re.findall(r'^ {2,}' + name + r': (.+)$', block, re.M)
            if len(found) != 1:
                errors.append(f'{ident}: expected one {name} field')
            else:
                fields[name] = found[0].strip()
        refs = fields.get('Refs', '')
        if not re.fullmatch(r'[RP]-[1-9]\d*(?:, [RP]-[1-9]\d*)*', refs):
            errors.append(f'{ident}: invalid Refs')
        linked = set(re.findall(REF, refs))
        covered |= linked
        for ref in sorted(linked - known):
            errors.append(f'{ident}: unknown requirement {ref}')
        deps = fields.get('Depends', '')
        if deps != 'none':
            if not re.fullmatch(r'T-[1-9]\d*(?:, T-[1-9]\d*)*', deps):
                errors.append(f'{ident}: invalid Depends')
            for dep in re.findall(r'T-[1-9]\d*', deps):
                if dep not in seen:
                    errors.append(f'{ident}: dependency {dep} must be an earlier task')
        seen.add(ident)
        evidence = fields.get('Evidence', '')
        if match[1].lower() == 'x' and (not evidence or evidence.lower() == 'pending' or PLACEHOLDER.search(evidence)):
            errors.append(f'{ident}: completed task needs actual Evidence')
        if status == ['done'] and match[1] == ' ':
            errors.append(f'{ident}: still open in a done spec')
    for ident in sorted(known - covered):
        errors.append(f'{ident}: no task coverage')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    new = commands.add_parser('new', help='Create a draft spec without overwriting existing files')

    new.add_argument('spec', type=slug)
    new.add_argument('--workflow', choices=WORKFLOWS, default=WORKFLOWS[0])
    check = commands.add_parser('check', help='Validate specs; does not execute AI or tests')
    check.add_argument('path', nargs='?', type=Path)
    check.add_argument('--ready', action='store_true', help='Reject drafts and placeholders')
    args = parser.parse_args()
    try:
        if args.command == 'new':
            target = new_spec(ROOT, 'studio-lunia', args.spec, args.workflow)
            print(f'Created draft: {target.relative_to(ROOT)}')
            return 0
        if args.path:
            target = args.path.absolute()
            no_symlinks(target, ROOT)
            if (target / 'specs').is_dir():
                specs = sorted(p for p in (target / 'specs').iterdir() if p.is_dir())
            else:
                specs = [target]
        else:
            specs = sorted(p for p in (ROOT / 'specs').glob('*') if p.is_dir())
        if not specs:
            raise ValueError('No specs found')
        failed = False
        for spec in specs:
            no_symlinks(spec, ROOT)
            for name in ('requirements.md', 'design.md', 'tasks.md'):
                no_symlinks(spec / name, ROOT)
            errors = check_spec(spec, args.ready)
            failed |= bool(errors)
            print(f'{"FAIL" if errors else "OK"} {spec.relative_to(ROOT)}')
            for error in errors:
                print(f'  - {error}')
        print('Structural check only; run the project verification commands separately.')
        return int(failed)
    except (OSError, ValueError) as error:
        print(f'Error: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
