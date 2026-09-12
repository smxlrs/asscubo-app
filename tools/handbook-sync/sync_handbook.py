#!/usr/bin/env python3
"""Read published Supabase handbook content and create a versioned LaTeX export."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, unquote
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
FIELDS = 'id,title,order_index,content_type,content_body,content_url,parent_id,is_published,updated_at'

# Only the guide chapters are synchronized. Cover, declaration, appendix,
# bibliography, closing pages, and their local PDF assets stay local.
BODY_SPECS = [
    ('welcome', 2, 3),
    ('firstweek', 3, 4),
    ('connect', 4, 5),
    ('utiles', 5, 6),
    ('locals', 6, 7),
    ('tour', 7, 8),
    ('enrollment', 8, 9),
    ('ababo', 9, 10),
    ('asscubo', 10, 11),
    ('faq', 11, 12),
]


def read_env(path):
    result = {}
    if path and Path(path).is_file():
        for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*)', line)
            if match:
                result[match[1]] = match[2].strip().strip('\"\'')
    return result


def credentials(config):
    env = {**read_env(config.get('env_file')), **os.environ}
    url = env.get('EXPO_PUBLIC_SUPABASE_URL') or config.get('supabase_url')
    key = env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') or config.get('supabase_publishable_key')
    if not url or not key:
        raise ValueError('请在 sync-config.json 填写 Supabase 地址和公开读取密钥，或指定 App 的 .env 文件。')
    if not url.startswith('https://'):
        raise ValueError('Supabase 地址必须使用 HTTPS。')
    # This exporter intentionally supports only public access, never admin credentials.
    if not key.startswith('sb_publishable_'):
        import base64
        try:
            payload = json.loads(base64.urlsafe_b64decode(key.split('.')[1] + '==='))
        except Exception:
            raise ValueError('请使用 publishable key 或 anon key。') from None
        if payload.get('role') != 'anon':
            raise ValueError('同步工具只接受公开读取密钥，不接受管理员密钥。')
    return url.rstrip('/'), key


def fetch_chapters(config):
    url, key = credentials(config)
    rows, offset, expected = [], 0, None
    while True:
        query = urlencode({'select': FIELDS, 'is_published': 'eq.true',
                           'order': 'order_index.asc,id.asc', 'limit': 500, 'offset': offset})
        request = Request(url + '/rest/v1/handbook_chapters?' + query,
                          headers={'apikey': key, 'Prefer': 'count=exact'})
        with urlopen(request, timeout=60) as response:
            page = json.load(response)
            content_range = response.headers.get('Content-Range', '')
        if not isinstance(page, list):
            raise ValueError('Supabase 返回的数据格式无效。')
        total = content_range.rsplit('/', 1)[-1]
        if total.isdigit():
            if expected is not None and expected != int(total):
                raise ValueError('同步期间章节数量发生变化，请重新运行。')
            expected = int(total)
        if not page:
            break
        rows.extend(page)
        offset += len(page)
        if expected is not None and offset >= expected:
            break
    if expected is not None and len(rows) != expected:
        raise ValueError('章节下载不完整，请重新运行。')
    if not rows:
        raise ValueError('没有读到已发布章节，已停止，保留上次同步结果。')
    return rows


def ordered_chapters(rows):
    by_id = {row['id']: row for row in rows}
    if len(by_id) != len(rows):
        raise ValueError('章节 ID 重复，请重新同步。')
    children = {}
    for row in rows:
        if not row.get('is_published'):
            raise ValueError('数据包含未发布章节。')
        children.setdefault(row.get('parent_id'), []).append(row)
    for siblings in children.values():
        siblings.sort(key=lambda r: (r['order_index'], r['id']))
    result, visited = [], set()

    def walk(parent, depth):
        for row in children.get(parent, []):
            if row['id'] in visited:
                raise ValueError('目录存在循环。')
            visited.add(row['id'])
            result.append((row, depth))
            walk(row['id'], depth + 1)
    walk(None, 1)
    # Same visibility rule as the App: published children of hidden parents are absent.
    skipped = [row['title'] for row in rows if row['id'] not in visited]
    for row in rows:
        seen, current = set(), row
        while current and current.get('parent_id') in by_id:
            if current['id'] in seen:
                raise ValueError('目录存在循环，请先在 App 中修正。')
            seen.add(current['id'])
            current = by_id.get(current['parent_id'])
    if not result:
        raise ValueError('没有可显示的一级目录。')
    return result, skipped


def pandoc_path(config):
    candidates = [config.get('pandoc'), HERE / '.tools/pypandoc/files/pandoc.exe',
                  HERE.parent.parent / '.tmp/handbook-sync-deps/pypandoc/files/pandoc.exe',
                  shutil.which('pandoc')]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise ValueError('缺少 Pandoc。请先运行 install-dependencies.cmd。')


def pandoc(executable, args, text, cwd):
    process = subprocess.run([executable, *args], input=text, encoding='utf-8',
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd)
    if process.returncode:
        raise ValueError('Markdown 转换失败：' + process.stderr[-2500:])
    return process.stdout


def nodes(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from nodes(item)
    elif isinstance(value, list):
        for item in value:
            yield from nodes(item)


def plain(inlines):
    return ''.join(n.get('c', '') if n.get('t') == 'Str' else ' ' if n.get('t') == 'Space' else ''
                   for n in nodes(inlines))


def anchor(row):
    return 'chapter-' + hashlib.sha256(row['id'].encode()).hexdigest()[:20]


def link_targets(ordered):
    aliases = {}
    roots = [row for row, depth in ordered if depth == 1]
    # Match the App's legacy numeric references (first two roots are front matter).
    root_numbers = {row['id']: i - 1 for i, row in enumerate(roots) if i >= 2}
    for row, depth in ordered:
        target = anchor(row)
        for alias in (row['id'], row['title'].strip().lower()):
            aliases.setdefault(alias, target)
        number = root_numbers.get(row['id'])
        if number is not None:
            aliases.setdefault(str(number), target)
        elif row.get('parent_id') in root_numbers:
            aliases.setdefault(f"{root_numbers[row['parent_id']]}.{row['order_index']}", target)
    return aliases


def media_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if data.startswith(b'\xff\xd8\xff'):
        return '.jpg'
    if data.startswith(b'%PDF-'):
        return '.pdf'
    raise ValueError('图片格式不是 PNG/JPEG/PDF；请将该图片转换为 PNG/JPEG 后更新 App。')


def download_asset(url, directory, project, overrides=None):
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.netloc:
        raise ValueError('图片或附件需要完整的 HTTP(S) 地址：' + url)
    # Never attach the Supabase key to media requests or third-party hosts.
    if url in (overrides or {}):
        data = Path(overrides[url]).read_bytes()
    else:
        try:
            with urlopen(Request(url, headers={'User-Agent': 'ASSCUBO-Handbook-Sync/1.0'}), timeout=60) as response:
                data = response.read(50 * 1024 * 1024 + 1)
        except (HTTPError, URLError) as error:
            raise ValueError(f'附件下载失败：{url} ({error})') from None
    if len(data) > 50 * 1024 * 1024:
        raise ValueError('单个附件超过 50 MB。')
    extension = media_type(data)
    name = hashlib.sha256(url.encode()).hexdigest()[:24] + extension
    destination = directory / name
    destination.write_bytes(data)
    return destination.relative_to(project).as_posix()


def export(config, rows, project):
    ordered, skipped = ordered_chapters(rows)
    exe = pandoc_path(config)
    if not (project / 'main.tex').is_file():
        raise ValueError('目标目录中没有 main.tex，请检查 project_dir。')
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    run = project / 'handbook-sync/runs' / run_id
    run.mkdir(parents=True)
    assets = run / 'assets'
    assets.mkdir()
    (run / 'chapters.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    documents, urls = [], set()
    warnings = ['父目录未发布，跟随 App 隐藏：' + title for title in skipped]
    aliases = link_targets(ordered)
    for row, depth in ordered:
        if depth > 5:
            raise ValueError('目录超过五层，无法可靠排版。')
        body = row.get('content_body') or ''
        (run / (anchor(row) + '.md')).write_text(body, encoding='utf-8')
        ast = json.loads(pandoc(exe, ['-f', 'gfm', '-t', 'json'], body.replace('\u2002', ' '), project))
        headers = [n['c'][0] for n in nodes(ast['blocks']) if n.get('t') == 'Header']
        minimum = min(headers) if headers else 1
        for node in nodes(ast['blocks']):
            if node.get('t') == 'Header':
                node['c'][0] = min(6, depth + 1 + node['c'][0] - minimum)
                node['c'][1][0] = anchor(row) + '-' + node['c'][1][0]
            elif node.get('t') == 'Image':
                urls.add(node['c'][2][0])
            elif node.get('t') in ('RawBlock', 'RawInline'):
                # GFM can contain HTML. Do not silently lose it in LaTeX output.
                if node['c'][0] == 'html' and not re.fullmatch(r'\s*<br\s*/?>\s*', node['c'][1], re.I):
                    raise ValueError(f"章节“{row['title']}”包含 HTML，请改用 Markdown 后再同步。")
                node.update(t='LineBreak', c=[]) if node.get('t') == 'RawInline' else node.update(t='Para', c=[])
        if row['content_type'] == 'pdf':
            if not row.get('content_url'):
                raise ValueError('PDF 章节缺少地址：' + row['title'])
            urls.add(row['content_url'])
        elif row['content_type'] != 'richtext':
            raise ValueError('未知内容类型：' + row['content_type'])
        documents.append((row, depth, ast))
    print(f'正在下载 {len(urls)} 个图片或 PDF 附件…', flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        local = dict(zip(sorted(urls), pool.map(lambda url: download_asset(url, assets, project, config.get('asset_overrides')), sorted(urls))))
    combined = {'pandoc-api-version': documents[0][2]['pandoc-api-version'], 'meta': {}, 'blocks': []}
    front_matter = set([row['id'] for row, depth in ordered if depth == 1][:2])
    for row, depth, ast in documents:
        classes = ['unnumbered'] if row['id'] in front_matter else []
        heading = {'t': 'Header', 'c': [depth, [anchor(row), classes, []], [{'t': 'Str', 'c': row['title']}]]}
        combined['blocks'].append(heading)
        local_headers = {n['c'][1][0][len(anchor(row)) + 1:]: n['c'][1][0]
                         for n in nodes(ast['blocks']) if n.get('t') == 'Header'}
        for node in nodes(ast['blocks']):
            if node.get('t') == 'Header' and row['id'] in front_matter:
                node['c'][1][1].append('unnumbered')
            elif node.get('t') == 'Image':
                node['c'][2][0] = local[node['c'][2][0]]
                # Legacy image alt text often contains a filename, not a caption.
                caption = plain(node['c'][1])
                if '/' in caption or re.search(r'\.(png|jpe?g|pdf)$', caption, re.I):
                    node['c'][1] = []
            elif node.get('t') == 'Link':
                url = node['c'][2][0]
                # GFM's bare-email matcher can swallow adjacent Chinese prose.
                # Preserve that prose as the label but restrict mailto to the address.
                if url.startswith('mailto:') and not url.isascii():
                    email = re.search(r"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", url[7:])
                    if email:
                        url = 'mailto:' + email[0]
                        node['c'][2][0] = url
                    else:
                        # A domain suffix such as “或@studio.unibo.it” is prose.
                        node.update(t='Span', c=[['', [], []], node['c'][1]])
                        continue
                target = unquote(re.sub(r'^(handbook://|#)', '', url)).strip().lower()
                if target in aliases:
                    node['c'][2][0] = '#' + aliases[target]
                elif url.startswith('#') and unquote(url[1:]) in local_headers:
                    node['c'][2][0] = '#' + local_headers[unquote(url[1:])]
                elif url.startswith(('handbook://', '#')):
                    # Preserve unresolved links and report them, rather than guessing.
                    warnings.append(f"未找到内部链接：{row['title']} → {url}")
        if row['content_type'] == 'pdf':
            path = local[row['content_url']]
            if not path.endswith('.pdf'):
                raise ValueError('PDF 章节地址返回的不是 PDF：' + row['title'])
            combined['blocks'].append({'t': 'RawBlock', 'c': ['latex', r'\includepdf[pages=-]{' + path + '}']})
        else:
            combined['blocks'].extend(ast['blocks'])
    latex = pandoc(exe, ['-f', 'json', '-t', 'latex', '--standalone', '--top-level-division=chapter',
                        '--table-of-contents', '--number-sections', '--syntax-highlighting=none',
                        '-V', 'documentclass=ctexbook', '-V', 'classoption=oneside,openany',
                        '-V', 'fontsize=12pt', '-V', 'geometry:margin=25mm',
                        '-V', 'colorlinks=true', '-V', 'CJKmainfont=FandolKai-Regular',
                        '-V', 'CJKoptions=BoldFont=FandolHei-Regular',
                        '-V', 'header-includes=\\usepackage{pdfpages}\n\\InputIfFileExists{sync-layout.tex}{}{}'],
                   json.dumps(combined, ensure_ascii=False), project)
    # Pandoc's full-page image limit needs space left for captions and page furniture.
    latex = latex.replace(r'\Gscale@div\@tempa{\textheight}', r'\Gscale@div\@tempa{0.82\textheight}')
    (run / 'book.tex').write_text(latex, encoding='utf-8')

    # Also emit fragments that use the legacy project's own preamble and
    # chapter order. The original body/*.tex files remain untouched.
    root_blocks = {}
    active_root = None
    for block in combined['blocks']:
        if block.get('t') == 'Header' and block['c'][0] == 1:
            active_root = block['c'][1][0]
            root_blocks[active_root] = []
        if active_root is not None:
            root_blocks[active_root].append(block)

    roots = [row for row, depth in ordered if depth == 1]
    if len(roots) >= 12:
        fragment_dir = run / 'body'
        fragment_dir.mkdir()
        for name, start, end in BODY_SPECS:
            selected = roots[start:end]
            blocks = []
            for root in selected:
                blocks.extend(root_blocks.get(anchor(root), []))
            fragment_ast = {'pandoc-api-version': combined['pandoc-api-version'], 'meta': {}, 'blocks': blocks}
            fragment = pandoc(exe, ['-f', 'json', '-t', 'latex', '--top-level-division=chapter',
                                    '--number-sections', '--syntax-highlighting=none', '--wrap=none'],
                              json.dumps(fragment_ast, ensure_ascii=False), project)
            (fragment_dir / (name + '.tex')).write_text(fragment, encoding='utf-8')

        current_body = project / 'handbook-sync/current/body'
        current_body.mkdir(parents=True, exist_ok=True)
        for name, _, _ in BODY_SPECS:
            pointer = (run / 'body' / (name + '.tex')).relative_to(project).as_posix()
            (current_body / (name + '.tex')).write_text('\\input{' + pointer + '}\n', encoding='utf-8')

        # Preserve the exact legacy main.tex layout and setup includes. Only
        # the body input paths are redirected to the current generated snapshot.
        original_main = (project / 'main.tex').read_text(encoding='utf-8-sig')
        mapped_names = {name for name, _, _ in BODY_SPECS}
        def replace_body_input(match):
            name = match.group(1)
            if name in mapped_names:
                return r'\input{handbook-sync/current/body/' + name + r'}'
            return match.group(0)
        structured_main = re.sub(r'\\input\{body/([^}]+)\}', replace_body_input, original_main)
        (project / 'main-synced.tex').write_text(
            '% Auto-generated from main.tex; original main.tex and body files are unchanged.\n' + structured_main,
            encoding='utf-8',
        )
    else:
        warnings.append(f'一级目录只有 {len(roots)} 个，未生成攻略 body 结构映射。')
    report = {'synced_at_utc': run_id, 'chapters': len(ordered), 'assets': len(urls), 'warnings': warnings}
    (run / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    # Switch to a complete snapshot only after ALL downloads and conversion succeed.
    entry = project / 'main-synced.tex'
    layout = project / 'sync-layout.tex'
    if not layout.exists():
        layout.write_text('% 可自行修改字号、页眉等；同步不会覆盖本文件。\n\\setlength{\\emergencystretch}{3em}\n', encoding='utf-8')
    pointer = project / 'handbook-sync' / ('current-' + run_id + '.tmp')
    pointer.write_text('\\input{' + (run / 'book.tex').relative_to(project).as_posix() + '}\n', encoding='utf-8')
    os.replace(pointer, project / 'handbook-sync/current.tex')
    print(f'同步成功：{len(ordered)} 个章节，{len(urls)} 个附件。\n请用 XeLaTeX 编译：{entry}\n首次或目录变更后，请编译两次。', flush=True)
    for warning in warnings:
        print('提示：' + warning)
    return report


def main():
    parser = argparse.ArgumentParser(description='将 Supabase 已发布手册同步为 LaTeX；不会生成 PDF。')
    parser.add_argument('--config', type=Path, default=HERE / 'sync-config.json')
    parser.add_argument('--project-dir', type=Path)
    parser.add_argument('--inspect', action='store_true', help='只读取并显示章节概况，不写入项目')
    parser.add_argument('--snapshot', type=Path, help='从已保存的 chapters.json 离线读取正文（附件仍需联网）')
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8-sig'))
    for key in ('env_file', 'pandoc', 'project_dir'):
        if config.get(key) and not Path(config[key]).is_absolute():
            config[key] = str((args.config.resolve().parent / config[key]).resolve())
    config['asset_overrides'] = {url: str((args.config.resolve().parent / path).resolve())
                                 for url, path in config.get('asset_overrides', {}).items()}
    project = (args.project_dir or Path(config.get('project_dir', str(HERE)))).resolve()
    rows = json.loads(args.snapshot.read_text(encoding='utf-8')) if args.snapshot else fetch_chapters(config)
    if args.inspect:
        ordered, skipped = ordered_chapters(rows)
        print(json.dumps({'published': len(rows), 'visible': len(ordered), 'skipped': skipped,
                          'roots': [r['title'] for r, d in ordered if d == 1],
                          'pdf_chapters': sum(r['content_type'] == 'pdf' for r in rows)}, ensure_ascii=False, indent=2))
        return
    export(config, rows, project)


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    try:
        main()
    except (ValueError, OSError, KeyError, HTTPError, URLError) as error:
        print('同步失败，上次成功的正文保持不变。\n原因：' + str(error), file=sys.stderr)
        sys.exit(1)
