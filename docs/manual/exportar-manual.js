/**
 * Genera PDF y Word del manual (README.md + capturas).
 * node docs/manual/exportar-manual.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const README = path.join(ROOT, 'README.md');
const OUT_DIR = __dirname;
const HTML_PATH = path.join(OUT_DIR, '_manual.html');
const PDF_PATH = path.join(OUT_DIR, 'Manual-de-usuario.pdf');
const DOCX_PATH = path.join(OUT_DIR, 'Manual-de-usuario.docx');

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function imgSrc(rel) {
    const file = path.resolve(ROOT, rel.replace(/\//g, path.sep));
    if (!fs.existsSync(file)) {
        return rel;
    }
    const ext = path.extname(file).slice(1).toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'webp' ? 'webp' : 'png';
    return `data:image/${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function inline(text) {
    let s = escapeHtml(text);
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
        return `<figure><img src="${imgSrc(src)}" alt="${escapeHtml(alt)}"><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
}

function mdToHtml(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let inCode = false;
    let code = [];
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith('```')) {
            if (inCode) {
                out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
                code = [];
                inCode = false;
            } else {
                inCode = true;
            }
            i += 1;
            continue;
        }
        if (inCode) {
            code.push(line);
            i += 1;
            continue;
        }
        if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*-+/.test(lines[i + 1])) {
            const rows = [];
            while (i < lines.length && /^\s*\|/.test(lines[i])) {
                const cells = lines[i]
                    .replace(/^\s*\|/, '')
                    .replace(/\|\s*$/, '')
                    .split('|')
                    .map((c) => c.trim());
                rows.push(cells);
                i += 1;
            }
            const head = rows[0];
            const body = rows.slice(2);
            out.push('<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
            for (const row of body) {
                out.push('<tr>' + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
            }
            out.push('</tbody></table>');
            continue;
        }
        if (/^---+\s*$/.test(line)) {
            out.push('<hr>');
            i += 1;
            continue;
        }
        const h = /^(#{1,3})\s+(.+)$/.exec(line);
        if (h) {
            out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
            i += 1;
            continue;
        }
        if (/^\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
                i += 1;
            }
            out.push(`<ol>${items.join('')}</ol>`);
            continue;
        }
        if (/^[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
                i += 1;
            }
            out.push(`<ul>${items.join('')}</ul>`);
            continue;
        }
        if (!line.trim()) {
            i += 1;
            continue;
        }
        out.push(`<p>${inline(line)}</p>`);
        i += 1;
    }
    return out.join('\n');
}

const css = `
  :root { --rojo: #7f1d1d; --texto: #1f2937; --muted: #6b7280; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Calibri, Arial, sans-serif; color: var(--texto); font-size: 11pt; line-height: 1.45; margin: 0; }
  h1 { color: var(--rojo); font-size: 22pt; margin: 0 0 8pt; }
  h2 { color: var(--rojo); font-size: 14pt; margin: 22pt 0 8pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; page-break-after: avoid; }
  h3 { color: #111827; font-size: 12pt; margin: 16pt 0 6pt; page-break-after: avoid; }
  p, li { margin: 0 0 6pt; }
  ul, ol { margin: 0 0 10pt 18pt; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 1px solid #d1d5db; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  code, pre { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; }
  pre { background: #f9fafb; border: 1px solid #e5e7eb; padding: 8pt; overflow: auto; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16pt 0; }
  figure { margin: 10pt 0 16pt; page-break-inside: avoid; }
  img { max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 4px; }
  figcaption { font-size: 9pt; color: var(--muted); margin-top: 4pt; }
  .lead { color: var(--muted); margin-bottom: 16pt; }
  @page { size: letter; margin: 16mm 16mm 18mm 16mm; }
`;

function buildHtml(body) {
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Manual de usuario — Empresa Demo</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function chromePdf(htmlFile, pdfFile) {
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const fileUrl = 'file:///' + htmlFile.replace(/\\/g, '/');
    const r = spawnSync(
        chrome,
        [
            '--headless=new',
            '--disable-gpu',
            '--no-pdf-header-footer',
            `--print-to-pdf=${pdfFile}`,
            '--print-to-pdf-no-header',
            fileUrl
        ],
        { timeout: 120000, encoding: 'utf8' }
    );
    if (r.status !== 0 && !fs.existsSync(pdfFile)) {
        throw new Error(r.stderr || r.stdout || `Chrome salió con código ${r.status}`);
    }
}

function loadDocxLib() {
    const tmp = path.join(require('os').tmpdir(), 'ingenio-manual-build');
    fs.mkdirSync(tmp, { recursive: true });
    const pkg = path.join(tmp, 'package.json');
    if (!fs.existsSync(pkg)) {
        fs.writeFileSync(pkg, JSON.stringify({ name: 'manual-build', private: true }));
    }
    const inst = spawnSync('npm', ['install', 'docx@9.5.1', '--omit=dev'], {
        cwd: tmp,
        encoding: 'utf8',
        shell: true,
        timeout: 120000
    });
    if (inst.status !== 0) {
        throw new Error(inst.stderr || inst.stdout || 'npm install docx falló');
    }
    return require(path.join(tmp, 'node_modules', 'docx'));
}

function pngSize(buf) {
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
        return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    return { w: 1280, h: 720 };
}

function textRuns(docx, text) {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0;
    let m = re.exec(text);
    while (m) {
        if (m.index > last) {
            parts.push(new docx.TextRun(text.slice(last, m.index)));
        }
        if (m[0].startsWith('**')) {
            parts.push(new docx.TextRun({ text: m[0].slice(2, -2), bold: true }));
        } else {
            parts.push(new docx.TextRun({ text: m[0].slice(1, -1), font: 'Consolas' }));
        }
        last = m.index + m[0].length;
        m = re.exec(text);
    }
    if (last < text.length) {
        parts.push(new docx.TextRun(text.slice(last)));
    }
    return parts.length ? parts : [new docx.TextRun('')];
}

function imageBlocks(docx, rel, alt) {
    const file = path.resolve(ROOT, rel.replace(/\//g, path.sep));
    if (!fs.existsSync(file)) {
        return [new docx.Paragraph({ children: [new docx.TextRun({ text: alt, italics: true })] })];
    }
    const data = fs.readFileSync(file);
    const { w, h } = pngSize(data);
    const maxW = 620;
    const width = maxW;
    const height = Math.max(80, Math.round((h / w) * maxW));
    return [
        new docx.Paragraph({
            children: [
                new docx.ImageRun({
                    type: 'png',
                    data,
                    transformation: { width, height }
                })
            ],
            spacing: { before: 120, after: 60 }
        }),
        new docx.Paragraph({
            children: [new docx.TextRun({ text: alt, italics: true, size: 18, color: '6B7280' })],
            spacing: { after: 200 }
        })
    ];
}

function cellBorders() {
    const b = { style: 'single', size: 4, color: 'D1D5DB' };
    return { top: b, bottom: b, left: b, right: b };
}

async function wordFromMarkdown(md) {
    const docx = loadDocxLib();
    const children = [];
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    let i = 0;
    let inCode = false;
    let code = [];
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith('```')) {
            if (inCode) {
                children.push(
                    new docx.Paragraph({
                        shading: { type: 'clear', fill: 'F9FAFB' },
                        children: [new docx.TextRun({ text: code.join('\n'), font: 'Consolas', size: 18 })]
                    })
                );
                code = [];
                inCode = false;
            } else {
                inCode = true;
            }
            i += 1;
            continue;
        }
        if (inCode) {
            code.push(line);
            i += 1;
            continue;
        }
        const img = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line);
        if (img) {
            children.push(...imageBlocks(docx, img[2], img[1]));
            i += 1;
            continue;
        }
        if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*-+/.test(lines[i + 1])) {
            const rows = [];
            while (i < lines.length && /^\s*\|/.test(lines[i])) {
                const cells = lines[i]
                    .replace(/^\s*\|/, '')
                    .replace(/\|\s*$/, '')
                    .split('|')
                    .map((c) => c.trim());
                rows.push(cells);
                i += 1;
            }
            const head = rows[0];
            const body = rows.slice(2);
            const makeCell = (text, header) =>
                new docx.TableCell({
                    borders: cellBorders(),
                    width: { size: Math.round(9000 / head.length), type: docx.WidthType.DXA },
                    shading: header ? { type: 'clear', fill: 'F3F4F6' } : undefined,
                    children: [new docx.Paragraph({ children: textRuns(docx, text) })]
                });
            const tableRows = [
                new docx.TableRow({ children: head.map((c) => makeCell(c, true)) }),
                ...body.map((row) => new docx.TableRow({ children: row.map((c) => makeCell(c, false)) }))
            ];
            children.push(
                new docx.Table({
                    width: { size: 9000, type: docx.WidthType.DXA },
                    rows: tableRows
                })
            );
            children.push(new docx.Paragraph({ text: '' }));
            continue;
        }
        if (/^---+\s*$/.test(line) || !line.trim()) {
            i += 1;
            continue;
        }
        const h = /^(#{1,3})\s+(.+)$/.exec(line);
        if (h) {
            const level = h[1].length === 1 ? docx.HeadingLevel.HEADING_1 : h[1].length === 2 ? docx.HeadingLevel.HEADING_2 : docx.HeadingLevel.HEADING_3;
            children.push(new docx.Paragraph({ heading: level, children: textRuns(docx, h[2]) }));
            i += 1;
            continue;
        }
        if (/^\d+\.\s+/.test(line)) {
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                children.push(
                    new docx.Paragraph({
                        numbering: { reference: 'num', level: 0 },
                        children: textRuns(docx, lines[i].replace(/^\d+\.\s+/, ''))
                    })
                );
                i += 1;
            }
            continue;
        }
        if (/^[-*]\s+/.test(line)) {
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                children.push(
                    new docx.Paragraph({
                        bullet: { level: 0 },
                        children: textRuns(docx, lines[i].replace(/^[-*]\s+/, ''))
                    })
                );
                i += 1;
            }
            continue;
        }
        children.push(new docx.Paragraph({ children: textRuns(docx, line), spacing: { after: 120 } }));
        i += 1;
    }
    const doc = new docx.Document({
        numbering: {
            config: [{ reference: 'num', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'left' }] }]
        },
        styles: {
            default: { document: { run: { font: 'Calibri', size: 22 } } },
            paragraphStyles: [
                { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickStyle: true, run: { size: 36, bold: true, color: '7F1D1D', font: 'Calibri' } },
                { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickStyle: true, run: { size: 28, bold: true, color: '7F1D1D', font: 'Calibri' } },
                { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickStyle: true, run: { size: 24, bold: true, color: '111827', font: 'Calibri' } }
            ]
        },
        sections: [
            {
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 720, right: 720, bottom: 720, left: 720 }
                    }
                },
                children
            }
        ]
    });
    const buf = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(DOCX_PATH, buf);
}

async function main() {
    const md = fs.readFileSync(README, 'utf8');
    const html = buildHtml(mdToHtml(md));
    fs.writeFileSync(HTML_PATH, html);
    console.log('HTML listo');
    if (!fs.existsSync(PDF_PATH)) {
        chromePdf(HTML_PATH, PDF_PATH);
    }
    console.log('PDF:', PDF_PATH, fs.statSync(PDF_PATH).size, 'bytes');
    await wordFromMarkdown(md);
    console.log('Word:', DOCX_PATH, fs.statSync(DOCX_PATH).size, 'bytes');
    fs.unlinkSync(HTML_PATH);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
