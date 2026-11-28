# 📜 更新履歴

更新履歴はこのファイルに記録します。

## v1.0.0（2026-11-28）

### 追加

- 単体テストを新規作成（`tests/`、Node 標準のテストランナー、27件）。名前パース、グリッド検証、シャッフルの不変条件、自動拡張の計算、結果テキスト、保存データの検証を固定。
- CI に手動実行（workflow_dispatch）と単体テストのステップを追加。

### 変更

- 全体を作り直し（再作成）：旧実装と同一仕様のまま、純粋ロジックを `js/seat-core.js` に分離。保存形式（localStorage キー `sekiya-data` / `sekiya-theme`）と結果テキストの形式は従来どおりで、既存利用者のデータはそのまま引き継がれる。
- バージョン表記を日付管理から 1.0.0 にリセット。Service Worker のキャッシュ名を sekiya-v4 から sekiya-v1 に変更。
- Windows 版 exe を GitHub Release に添付しない運用に変更（Release はノートのみ）。Windows 版は `windows/build.bat` / `windows/build.sh` でビルドする。
