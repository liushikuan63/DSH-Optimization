"""Build portable, data-only ZIPs from this fixed source tree. No downloads."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import zipfile

REPO = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', required=True)
parser.add_argument('--component', choices=['all', 'plugin', 'full'], default='all')
args = parser.parse_args()
output = pathlib.Path(args.output_dir).resolve()
if output == REPO or REPO in output.parents:
    parser.error('output directory must be outside the repository')
roots = ['README.md', 'VIBECODING.md', 'VERSION', 'THIRD-PARTY-NOTICES.md', '.gitignore', '.gitattributes', 'docs', 'scripts', 'packages', 'overlays']
files = []
def collect(target):
    info = target.lstat()
    if target.is_symlink() or getattr(info, 'st_file_attributes', 0) & 0x400:
        parser.error('linked source path refused: ' + str(target.relative_to(REPO)))
    if target.name in {'node_modules', '.dsh', '.git', '__pycache__', 'backups', 'sessions', 'storages', 'logs'} or target.name.startswith('.env') or re.search(r'\.(?:log|tmp|bak|zip|tgz)$|\.bak-', target.name, re.I):
        parser.error('non-distributable member: ' + str(target.relative_to(REPO)))
    if target.is_dir():
        for child in sorted(target.iterdir()):
            collect(child)
    elif target.is_file():
        files.append(target)
    else:
        parser.error('special source file refused: ' + str(target.relative_to(REPO)))
for name in roots:
    collect(REPO / name)
version = (REPO / 'VERSION').read_text(encoding='utf8').strip()
package = REPO / 'packages' / 'ultimate-model'
pkg_version = json.loads((package / 'package.json').read_text(encoding='utf8'))['version']
if any(not isinstance(v, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', v) for v in [version, pkg_version]):
    parser.error('invalid release version')
if (package / 'cordis.patch.yml').read_bytes() != (package / 'cordis.patch.template.yml').read_bytes():
    parser.error('release source must contain the portable patch, not machine-specific materialization')
check = subprocess.run(['node', str(package / 'scripts' / 'build-manifest.mjs'), '--check'], cwd=package)
if check.returncode:
    sys.exit(check.returncode)
archives = [
    (output / f'Ultimate-Model-{pkg_version}.zip', package, 'ultimate-model', [file for file in files if package in file.parents]),
    (output / f'DSH-Optimization-{version}.zip', REPO, f'DSH-Optimization-{version}', files),
]
if args.component == 'plugin':
    archives = archives[:1]
elif args.component == 'full':
    archives = archives[1:]
output.mkdir(parents=True, exist_ok=True)
for filename, _, _, _ in archives:
    if filename.exists() or filename.with_suffix(filename.suffix + '.sha256').exists():
        parser.error('immutable output already exists: ' + str(filename))
results = []
for filename, base, prefix, members in archives:
    with zipfile.ZipFile(filename, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in members:
            info = zipfile.ZipInfo(prefix + '/' + file.relative_to(base).as_posix(), date_time=(2026, 11, 7, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes())
    with zipfile.ZipFile(filename) as archive:
        corrupt = archive.testzip()
        if corrupt:
            raise RuntimeError('CRC failure: ' + corrupt)
    digest = hashlib.sha256(filename.read_bytes()).hexdigest()
    filename.with_suffix(filename.suffix + '.sha256').write_text(digest + '  ' + filename.name + '\n', encoding='utf8')
    results.append({'file': str(filename), 'bytes': filename.stat().st_size, 'sha256': digest, 'members': len(members)})
print(json.dumps({'version': version, 'packageVersion': pkg_version, 'archives': results}, ensure_ascii=False, indent=2))
