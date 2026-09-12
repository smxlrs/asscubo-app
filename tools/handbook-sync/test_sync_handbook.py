import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import sync_handbook as sync


def chapter(id, parent=None, order=1, body='正文'):
    return dict(id=id, title=id, parent_id=parent, order_index=order,
                content_type='richtext', content_body=body, is_published=True)


class SyncTests(unittest.TestCase):
    def test_visibility_and_order_follow_parent_tree(self):
        ordered, skipped = sync.ordered_chapters([
            chapter('child', 'parent'), chapter('later', order=2),
            chapter('parent'), chapter('hidden-child', 'unpublished')])
        self.assertEqual([(r['id'], d) for r, d in ordered], [('parent', 1), ('child', 2), ('later', 1)])
        self.assertEqual(skipped, ['hidden-child'])

    def test_cycles_and_duplicate_ids_are_rejected(self):
        for rows in ([chapter('root'), chapter('a', 'b'), chapter('b', 'a')],
                     [chapter('same'), chapter('same')]):
            with self.assertRaises(ValueError):
                sync.ordered_chapters(rows)

    def test_pagination_respects_server_page_cap(self):
        pages = [[chapter('a')], [chapter('b')], [chapter('c')]]
        def respond(request, **kwargs):
            response = io.BytesIO(json.dumps(pages.pop(0)).encode())
            response.headers = {'Content-Range': '0-0/3'}
            return response
        with patch.object(sync, 'credentials', return_value=('https://example.test', 'sb_publishable_test')), patch.object(sync, 'urlopen', side_effect=respond) as fetch:
            self.assertEqual(len(sync.fetch_chapters({})), 3)
            self.assertIn('offset=2', fetch.call_args[0][0].full_url)

    def test_empty_result_is_not_success(self):
        response = io.BytesIO(b'[]')
        response.headers = {'Content-Range': '*/0'}
        with patch.object(sync, 'credentials', return_value=('https://example.test', 'sb_publishable_test')), patch.object(sync, 'urlopen', return_value=response):
            with self.assertRaises(ValueError):
                sync.fetch_chapters({})

    def test_non_image_response_is_rejected(self):
        with self.assertRaises(ValueError):
            sync.media_type(b'<html>Login page</html>')

    def test_legacy_numeric_links(self):
        ordered = [(chapter('cover'), 1), (chapter('notice'), 1),
                   (chapter('welcome'), 1), (chapter('tax', 'welcome', 3), 2)]
        aliases = sync.link_targets(ordered)
        self.assertEqual(aliases['1.3'], sync.anchor(chapter('tax')))

    def test_failed_conversion_preserves_active_book(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            (project / 'main.tex').write_text('ORIGINAL')
            (project / 'handbook-sync').mkdir()
            pointer = project / 'handbook-sync/current.tex'
            pointer.write_text('PREVIOUS')
            with patch.object(sync, 'pandoc_path', return_value='pandoc'), patch.object(sync, 'pandoc', side_effect=ValueError('conversion failed')):
                with self.assertRaises(ValueError):
                    sync.export({}, [chapter('root')], project)
            self.assertEqual(pointer.read_text(), 'PREVIOUS')
            self.assertEqual((project / 'main.tex').read_text(), 'ORIGINAL')

    def test_real_conversion_updates_deletes_and_keeps_snapshots(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            (project / 'main.tex').write_text('ORIGINAL')
            rows = [chapter('cover'), chapter('notice', order=2),
                    chapter('tax', order=3, body='## Details\n\n**100% & value_1**\n\n[local](#details)\n\n- first\n- second')]
            sync.export({}, rows, project)
            pointer = project / 'handbook-sync/current.tex'
            old_pointer = pointer.read_text()
            old_book = list((project / 'handbook-sync/runs').glob('*/book.tex'))[0]
            source = old_book.read_text(encoding='utf-8')
            self.assertIn(r'100\% \& value\_1', source)
            self.assertNotIn('local](#details)', source)
            rows[0]['content_body'] = 'UPDATED CONTENT'
            sync.export({}, rows[:2], project)
            self.assertNotEqual(pointer.read_text(), old_pointer)
            self.assertTrue(old_book.exists())
            newest = sorted((project / 'handbook-sync/runs').glob('*/book.tex'))[-1].read_text(encoding='utf-8')
            self.assertIn('UPDATED CONTENT', newest)
            self.assertNotIn(r'\chapter{tax}', newest)
            self.assertEqual((project / 'main.tex').read_text(), 'ORIGINAL')


if __name__ == '__main__':
    unittest.main()
