from pathlib import Path
root=Path('/app/saleor/graphql/warehouse/mutations')
for path in root.glob('*create*'):
    print(path.name)
    print(path.read_text()[:16000])
