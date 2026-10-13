"""Read-only disk/RAM summary and bounded scans of common local folders."""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import shutil
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

class MemoryStatus(ctypes.Structure):
    _fields_ = [('length', wintypes.DWORD), ('load', wintypes.DWORD)] + [
        (name, ctypes.c_ulonglong) for name in ['total_phys', 'avail_phys', 'total_page', 'avail_page', 'total_virtual', 'avail_virtual', 'avail_extended']]

status = MemoryStatus()
status.length = ctypes.sizeof(status)
ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
gib = lambda value: round(value / 1024**3, 2)
drives = []
for letter in 'CDEFGH':
    root = letter + ':\\'
    if ctypes.windll.kernel32.GetDriveTypeW(root) == 3:
        usage = shutil.disk_usage(root)
        drives.append({'drive': root, 'totalGiB': gib(usage.total), 'freeGiB': gib(usage.free)})
print(json.dumps({'disks': drives, 'ram': {'totalGiB': gib(status.total_phys), 'availableGiB': gib(status.avail_phys), 'usedPercent': status.load}}, ensure_ascii=False), flush=True)

def scan(root, seconds=12):
    size = 0
    count = 0
    errors = 0
    stack = [root]
    deadline = time.monotonic() + seconds
    largest = []
    while stack and time.monotonic() < deadline:
        folder = stack.pop()
        try:
            with os.scandir(folder) as entries:
                for entry in entries:
                    if entry.is_symlink():
                        continue
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            if not entry.stat(follow_symlinks=False).st_file_attributes & 0x400:
                                stack.append(entry.path)
                        else:
                            stat = entry.stat(follow_symlinks=False)
                            size += stat.st_size
                            count += 1
                            if stat.st_size >= 300 * 1024**2:
                                largest.append({'path': entry.path, 'GiB': gib(stat.st_size)})
                    except OSError:
                        errors += 1
        except OSError:
            errors += 1
    return {'path': str(root), 'logicalGiB': gib(size), 'files': count, 'partial': bool(stack), 'unreadable': errors, 'largeFiles': sorted(largest, key=lambda row: row['GiB'], reverse=True)[:5]}

profile = Path(os.environ['USERPROFILE'])
local = Path(os.environ['LOCALAPPDATA'])
folders = [profile / 'AppData' / 'Local' / 'Temp', profile / 'Downloads', profile / '.cache' / 'codex-runtimes',
           Path('C:/market bot'), profile / 'AppData' / 'Local' / 'Docker']
if '--temp-only' in sys.argv:
    folders = [profile / 'AppData' / 'Local' / 'Temp']
for folder in folders:
    if folder.exists():
        print(json.dumps(scan(folder), ensure_ascii=False), flush=True)
