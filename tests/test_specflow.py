import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('specflow', ROOT / 'scripts/specflow.py')
flow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flow)


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / 'templates', self.root / 'templates')

    def sample(self):
        path = self.root / 'spec'
        shutil.copytree(ROOT / 'specs/001-payload-foundation', path)
        return path

    def edit(self, path, name, old, new):
        file = path / name
        file.write_text(file.read_text().replace(old, new))

    def test_bootstrap_all_routes_and_draft_gate(self):
        for route in flow.WORKFLOWS:
            with self.subTest(route=route):
                path = flow.new_spec(self.root, 'demo', route, route)
                self.assertEqual(flow.check_spec(path), [])
                self.assertTrue(flow.check_spec(path, ready=True))
                self.assertNotIn('{{', (path / 'design.md').read_text())

    def test_never_overwrites_spec_or_project_context(self):
        path = flow.new_spec(self.root, 'demo', 'first', 'requirements-first')
        readme = path.parents[1] / 'README.md'
        readme.write_text('user content')
        flow.new_spec(self.root, 'demo', 'second', 'design-first')
        self.assertEqual(readme.read_text(), 'user content')
        with self.assertRaises(ValueError):
            flow.new_spec(self.root, 'demo', 'first', 'bugfix')

    def test_rejects_path_traversal_and_symlinks(self):
        for bad in ('../escape', '/tmp/escape', 'a/b', 'A', 'a--b', 'x'*65):
            with self.assertRaises(Exception):
                flow.new_spec(self.root, bad, 'spec', 'bugfix')
        (self.root / 'specs').symlink_to(self.root / 'templates', target_is_directory=True)
        with self.assertRaises(ValueError):
            flow.new_spec(self.root, 'demo', 'spec', 'bugfix')
        with self.assertRaises(ValueError):
            flow.no_symlinks(self.root / '../escape', self.root)

    def test_example_is_structurally_ready(self):
        self.assertEqual(flow.check_spec(self.sample(), ready=True), [])

    def test_broken_traceability_and_dependency_fail(self):
        path = self.sample()
        self.edit(path, 'tasks.md', 'Refs: R-1, R-4', 'Refs: R-99')
        self.edit(path, 'tasks.md', 'Depends: none', 'Depends: T-2')
        errors = '\n'.join(flow.check_spec(path))
        self.assertIn('unknown requirement R-99', errors)
        self.assertIn('R-99', errors)
        self.assertIn('must be an earlier task', errors)

    def test_duplicate_ids_missing_file_and_placeholders_fail(self):
        path = self.sample()
        self.edit(path, 'requirements.md', '### R-2:', '### R-1:')
        self.edit(path, 'design.md', '# Design', '# TODO')
        errors = '\n'.join(flow.check_spec(path))
        self.assertIn('Duplicate requirement', errors)
        self.assertIn('unresolved placeholder', errors)
        (path / 'design.md').unlink()
        self.assertIn('Missing design.md', flow.check_spec(path))

    def test_bugfix_requires_preservation(self):
        path = flow.new_spec(self.root, 'demo', 'fix', 'bugfix')
        self.edit(path, 'requirements.md', '### P-1:', '### R-2:')
        self.assertIn('Bugfix needs a preservation requirement P-…', flow.check_spec(path))

    def test_done_requires_evidence_and_closed_tasks(self):
        path = self.sample()
        req = path / 'requirements.md'
        req.write_text(req.read_text().replace('Status: ready', 'Status: done'))
        task = path / 'tasks.md'
        task.write_text('- [x] T-1: Implement\n  Refs: R-1, R-2, R-3, R-4, R-5\n  Depends: none\n  Verify: run tests\n  Evidence: pending\n')
        self.assertIn('completed task needs actual Evidence', '\n'.join(flow.check_spec(path)))
        task.write_text(task.read_text().replace('[x]', '[ ]'))
        self.assertIn('still open in a done spec', '\n'.join(flow.check_spec(path)))

    def test_formatted_task_indentation_is_supported(self):
        path = self.sample()
        task = path / 'tasks.md'
        task.write_text(task.read_text().replace('      Refs:', '  Refs:'))
        self.assertEqual(flow.check_spec(path), [])

    def test_cli_failure_exit_code(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/specflow.py'), 'check', str(ROOT / 'missing')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn('Missing requirements.md', result.stdout)


if __name__ == '__main__':
    unittest.main()
