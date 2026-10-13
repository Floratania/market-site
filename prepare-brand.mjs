import fs from 'node:fs/promises';
const source = await fs.readFile('C:/Users/tetiana.flora/.codex/attachments/91f6f621-24dd-43ae-a687-14b5f5006f13/Вставлений текст.txt', 'utf8');
await fs.writeFile('public/brand-reference.svg', source.trim());
await fs.copyFile('C:/Users/TETIAN~1.FLO/AppData/Local/Temp/codex-clipboard-60e3c282-a6dc-425a-afef-a4ffb3d04316.png', 'public/logo.png');
const logo = await fs.readFile('public/logo.png');
await fs.writeFile('public/brand-icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 110"><image href="data:image/png;base64,${logo.toString('base64')}" width="730" height="110"/></svg>`);
console.log('Brand assets saved.');
const html = await fs.readFile('public/index.html', 'utf8');
await fs.writeFile('public/index.html', html.replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/svg+xml" href="/brand-icon.svg">'));
