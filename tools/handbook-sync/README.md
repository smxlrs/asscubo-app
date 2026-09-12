# 新生手册同步工具

将 App 在 Supabase 中的已发布手册导出到原 LaTeX 项目。平时只在 App 管理员页面修改正文，需要 PDF 时运行一次同步，再手动编译。

## 日常使用

1. 在 App 管理员页面保存修改，并确认章节已发布。
2. 双击 `sync-handbook.cmd`，等待显示“同步成功”。
3. 在旧手册项目根目录打开 **`main-synced.tex`**，使用 **XeLaTeX** 编译。首次或目录变更后编译两次，得到 `main-synced.pdf`。

必须编译 `main-synced.tex`；原 `main.tex` 仍然是旧版内容。同步本身不生成 PDF。编译的工作目录应是手册项目根目录。

## 同步内容

- 已发布章节的标题、正文、层级、排序，以及新增和删除；未发布目录下的章节跟随 App 隐藏。
- Markdown 标题、加粗、列表、引用、表格、链接、代码及 PNG/JPEG/PDF 图片。
- PDF 类型的章节会下载附件并将所有页面插入同步版。
- 解析 App 的 `handbook://` 和数字章节链接。首两个一级目录按现有 App 的规则视为前言，不计章号。
- 每次重新下载远程附件，同一地址的图片更新也会同步。旧数据中失效的学联标志地址使用和 App 相同的内置图片，配置在 `asset_overrides`。

同步版的 `main-synced.tex` 会继续使用旧项目的 `setup/package.tex`、`setup/format.tex`、封面 `figures/c1.pdf`、封底 `figures/c2.pdf`、页眉页脚、附录 PDF、参考链接和封底顺序。它只把攻略章节 `welcome` 到 `faq` 的输入切换到 `handbook-sync/current/body/*.tex`；`preface`、`Appendix`、`biblio`、`remarks` 继续使用本地原文件。Supabase 中的图片、超链接和 PDF 附件不会替换本地印刷资产。

## 文件与备份

- `main-synced.tex`：按原 `main.tex` 结构生成的编译入口，每次同步会更新；原 `main.tex` 不变。
- `sync-layout.tex`：可以自己增加字体、页眉等 LaTeX 设置，同步不会覆盖。
- `handbook-sync/current/body/*.tex`：指向最近一次成功同步的各个章节文件；这些是入口指针，不是原始 `body/*.tex`。
- `handbook-sync/runs/时间戳/body/*.tex`：每次同步生成的独立攻略章节文件，按 `welcome`、`firstweek` 等旧项目名称保存。
- `handbook-sync/runs/时间戳/`：每次同步的 JSON、Markdown 原文、附件、完整 LaTeX 和 `report.json`。

原 `main.tex`、`body/`、封面以及原有 PDF 都不修改。下载或转换失败时，不切换当前正文。历史版本永久保留，可手动清理不再需要的旧目录；请保留 `current/body/` 指向的目录。完整快照中的 `book.tex` 仍会保留，便于回看和恢复旧版本。

同步后的正文是自动生成文件，手工修改会在下次同步时被新的快照取代；请在 App 中修改正式内容。

## 首次安装或迁移到其他电脑

需要 Python 3.10+、XeLaTeX（原项目的 MiKTeX 即可）以及 Pandoc。`install-dependencies.cmd` 可将 Pandoc 安装到本工具的 `.tools` 文件夹，不修改 App 依赖。

把 `sync-config.example.json` 复制为 `sync-config.json`，设置：

- `project_dir`：原手册项目目录，也可使用相对于配置文件的路径。
- `env_file`：App 的 `.env` 路径；或使用 `supabase_url` 和 `supabase_publishable_key` 两项。
- `pandoc`：可选，指定 Pandoc 可执行文件。
- `asset_overrides`：可选，将明确的远程图片地址映射到本地文件；相对路径以配置文件所在目录为准。

工具只通过公开读取权限请求 `handbook_chapters`，不写入 Supabase，也不需要管理员账户或 service role 密钥。请勿把个人配置或 `.env` 提交到代码仓库。

## 失败排查

窗口会说明原因。网络错误可重试；没有已发布内容时会停止，避免用空手册替换上次结果。附件失效、HTML 正文或不支持的图片格式会阻止同步，请修正对应内容。GIF、WebP、SVG 请先转为 PNG/JPEG；HTML 请改为 Markdown。附件最大 50 MB。

如果同步成功但 PDF 编译失败，请检查 MiKTeX 宏包及中文字体是否安装完整，并查看 `main-synced.log`。本工具不会自动安装或修改 TeX 环境。

命令行可选：

```text
python sync_handbook.py --inspect
python sync_handbook.py --project-dir "G:\学联\UnibostudetsC-main"
python sync_handbook.py --snapshot "某个旧版本目录\chapters.json"
```

`--inspect` 只读检查。`--snapshot` 从旧 JSON 恢复正文，但仍需联网下载附件；若需要完全恢复当时图片，请直接切换 `current.tex` 到旧快照。
