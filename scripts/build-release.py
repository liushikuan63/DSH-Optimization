"""Build portable DSH ZIPs from a fixed Git commit, without using worktree files."""
import argparse
import hashlib
import io
import json
import pathlib
import re
import subprocess
import sys
import tarfile
import tempfile
import zipfile


REPO = pathlib.Path(__file__).resolve().parents[1]
ROOTS = ('README.md', 'VIBECODING.md', 'VERSION', 'THIRD-PARTY-NOTICES.md',
         '.gitignore', '.gitattributes', 'docs', 'scripts', 'packages', 'overlays')
EXCLUDED = {'node_modules', '.dsh', '.git', '__pycache__', 'backups', 'sessions', 'storages', 'logs'}
PACKAGE = 'packages/ultimate-model'


def git(*args):
    return subprocess.run(['git', '-C', str(REPO), *args], capture_output=True, check=True).stdout


def committed_files(commit):
    # Git chooses the paths and bytes. In particular, neither caches nor
    # scratch files can enter the release by sharing a permitted parent.
    with tarfile.open(fileobj=io.BytesIO(git('archive', '--format=tar', commit, '--', *ROOTS))) as tree:
        files = {}
        seen = set()
        for member in tree:
            raw = member.name.rstrip('/')
            parts = raw.split('/')
            if (parts[0] not in ROOTS or any(part in {'', '.', '..'} or part.casefold() in EXCLUDED
                    or part.casefold().startswith('.env') or re.search(r'\.(?:log|tmp|bak|zip|tgz)$|\.bak-', part, re.I)
                    or any(char in part for char in '\\:') for part in parts)):
                raise ValueError(f'non-distributable member: {raw}')
            folded = raw.casefold()
            if folded in seen:
                raise ValueError(f'duplicate release path: {raw}')
            seen.add(folded)
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError(f'linked or special source path refused: {raw}')
            files[raw] = tree.extractfile(member).read()
        if any(not any(path == root or path.startswith(root + '/') for path in files) for root in ROOTS):
            raise ValueError('the commit does not contain all required release roots')
        return files


def check_component(files):
    if files[f'{PACKAGE}/cordis.patch.yml'] != files[f'{PACKAGE}/cordis.patch.template.yml']:
        raise ValueError('release source must contain the portable patch, not a machine-specific copy')
    # Run the component's manifest check against the byte set being shipped.
    with tempfile.TemporaryDirectory(prefix='dsh-release-') as tmp:
        root = pathlib.Path(tmp)
        package_files = {name[len(PACKAGE) + 1:]: data for name, data in files.items() if name.startswith(PACKAGE + '/')}
        for name, data in package_files.items():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        subprocess.run(['node', str(root / 'scripts/build-manifest.mjs'), '--check'], cwd=root, check=True)
        return package_files


def write_archive(filename, prefix, files):
    with zipfile.ZipFile(filename, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(prefix + '/' + name, date_time=(2026, 11, 7, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(filename) as archive:
        corrupt = archive.testzip()
        if corrupt:
            raise ValueError('CRC failure: ' + corrupt)
    digest = hashlib.sha256(filename.read_bytes()).hexdigest()
    with filename.with_suffix(filename.suffix + '.sha256').open('x', encoding='utf8', newline='\n') as sidecar:
        sidecar.write(digest + '  ' + filename.name + '\n')
    return {'file': filename.name, 'bytes': filename.stat().st_size, 'sha256': digest, 'members': len(files)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--source-commit', default='HEAD', help='Git commit or tag; default: HEAD')
    parser.add_argument('--component', choices=['all', 'plugin', 'full'], default='all')
    args = parser.parse_args()
    output = pathlib.Path(args.output_dir).resolve()
    if output == REPO or REPO in output.parents:
        parser.error('output directory must be outside the repository')
    try:
        commit = git('rev-parse', '--verify', '--end-of-options', args.source_commit + '^{commit}').decode().strip()
        files = committed_files(commit)
        version = files['VERSION'].decode('utf8').strip()
        package_version = json.loads(files[f'{PACKAGE}/package.json'])['version']
        if any(not isinstance(v, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', v)
               for v in [version, package_version]):
            raise ValueError('invalid release version')
        packages = check_component(files)
        archives = []
        if args.component in ('all', 'plugin'):
            archives.append((output / f'Ultimate-Model-{package_version}.zip', 'ultimate-model', packages))
        if args.component in ('all', 'full'):
            prefix = f'DSH-Optimization-{version}'
            archives.append((output / f'{prefix}.zip', prefix, files))
        build_info = output / f'DSH-Optimization-{version}-{args.component}-build.json'
        outputs = [build_info]
        for filename, _, _ in archives:
            outputs.extend((filename, filename.with_suffix(filename.suffix + '.sha256')))
        for file in outputs:
            if file.exists() or file.is_symlink():
                raise ValueError('immutable output already exists: ' + file.name)
        output.mkdir(parents=True, exist_ok=True)
        results = [write_archive(*archive) for archive in archives]
        record = {'schemaVersion': 1, 'sourceCommit': commit, 'version': version,
                  'packageVersion': package_version, 'component': args.component, 'archives': results,
                  'checks': {'portablePatch': 'passed', 'componentManifest': 'passed', 'archiveCrc': 'passed'},
                  'scope': 'artifact construction only; see separate Host acceptance'}
        with build_info.open('x', encoding='utf8', newline='\n') as handle:
            handle.write(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    except (subprocess.CalledProcessError, OSError, KeyError, ValueError) as error:
        parser.exit(1, f'build-release: {error}\n')
    print(json.dumps(record, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
