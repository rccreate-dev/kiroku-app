# このリポジトリで作業するときのルール（追加変更記録アプリ）

## Apps Script（承認サーバー）を編集するとき【必須】
他のアプリ（日繰表・施工手引き・検査アプリ・経費など）も、同じ Google アカウントの Apps Script を使っています。
プロジェクト名がすべて「無題のプロジェクト」のものがあり、取り違えやすいので、次を守ってください。

1. **編集してよいのは次の1つだけ**です。
   プロジェクト ID: `19ILqUaBgwxjDlUlnb8uKr4pD5TI7WTB0ZMtWuB6C4MKJAJ_3-TBeJBQI`
   （単体スクリプト。URL が `.../projects/19ILqUaBgwxjDlUlnb8uKr4pD5TI7WTB0ZMtWuB6C4MKJAJ_3-TBeJBQI/edit` であること）
2. 貼り付ける前に、エディタの先頭が「追加変更記録アプリ 承認用スクリプト」であること、関数に `apply_` `status_` `feedback_` があることを確認する。
   別の内容（freee・請求書・資金繰りなど）が出たら、**何も変更せず**に止めて、細野さんに報告する。
3. 全文を置き換える（setValue）前に、現在の中身の長さと関数名一覧を控え、貼り付け後に同じ項目で照合する。
4. 作業は**このプロジェクト1つだけ**を開いた状態で行う。他のプロジェクトのタブを同時に開かない。
5. 公開（デプロイ）後は、実行 URL に `?action=status&id=zzzzzzzz-test` を付けて開き、`{"ok":true,"status":"none"}` が返ることを確認する。
   `?action=feedback&id=x&text=t` が `{"ok":false,"error":"bad_id"}` なら、この版のコードが有効。
6. 他のアプリの Apps Script は、このリポジトリの作業では**開かない・読まない・変更しない**。
   他アプリの作業は、別のセッション・別のリポジトリで行う。

## 共通
- 公開のたびに `sw.js` の `CACHE` と `index.html` の `VERSION` を上げる。
- `CNAME` ファイルは消さない。
- 依頼がない push・送信・公開はしない。
- 日本語で、専門用語を避けて説明する。
