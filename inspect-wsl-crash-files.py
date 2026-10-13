"""Prepare a concrete read-only cleanup inventory; never delete files."""
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

sys.stdout.reconfigure(encoding='utf-8')
target = (Path(os.environ['USERPROFILE']) / 'AppData' / 'Local' / 'Temp' / 'wsl-crashes').resolve()
kernel = ctypes.WinDLL('kernel32', use_last_error=True)
allocated = kernel.GetCompressedFileSizeW
allocated.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(wintypes.DWORD)]
allocated.restype = wintypes.DWORD
files = []
with os.scandir(target) as entries:
    for entry in entries:
        if not entry.is_file(follow_symlinks=False) or not entry.name.startswith('wsl-crash-') or not entry.name.endswith('.dmp'):
            continue
        resolved = Path(entry.path).resolve()
        if resolved.parent != target:
            continue
        stat = entry.stat(follow_symlinks=False)
        high = wintypes.DWORD(0)
        ctypes.set_last_error(0)
        low = allocated(str(resolved), ctypes.byref(high))
        if low == 0xFFFFFFFF and ctypes.get_last_error():
            physical = None
        else:
            physical = (high.value << 32) + low
        files.append({'path': str(resolved), 'bytes': stat.st_size, 'allocatedBytes': physical,
                      'modifiedUtc': datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()})

report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'directory': str(target),
          'fileCount': len(files), 'logicalBytes': sum(row['bytes'] for row in files),
          'allocatedBytes': sum(row['allocatedBytes'] or 0 for row in files),
          'allocationChecksFailed': sum(row['allocatedBytes'] is None for row in files),
          'files': files, 'deletionPerformed': False}
(Path(__file__).parent / 'storage-cleanup-plan.local.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'files'}, ensure_ascii=False))
if files:
    print('Earliest modification: ' + min(row['modifiedUtc'] for row in files))
    print('Latest modification: ' + max(row['modifiedUtc'] for row in files))
