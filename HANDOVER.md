# 引き継ぎ：追加変更記録アプリ（株式会社RCCREATE）

最終更新: 2026-10-15

## 0. はじめに読むこと
- 依頼者は細野功介（株式会社RCCREATE 代表取締役、八王子の型枠工事会社）。開発者ではありません。日本語で、専門用語を避けて説明してください。
- パスワードやパスキーの入力は本人にしかできません。サインインが必要な場面では本人に依頼してください。Claude が認証情報を入力することはしません。
- 依頼されていない push・送信・公開はしないでください。
- 「確認できたこと」と「未確認のこと」を分けて報告してください。実機での確認は、これまでほとんど行えていません。
- Claude 側の記憶に次のファイルがあります。必要なら参照してください。
  - /areas/change-work-proof-app.md（アプリ本体の仕様・決定事項）
  - /areas/app-sales-business.md（販売の検討プロジェクト）

## 1. アプリの目的
- 職長が、追加変更工事の「証明資料」をスマホで作るためのアプリ（PWA）。
- 1つの追加変更工事を1件として登録。写真は何枚でもよく、写真ごとに「着手前／施工中／完了後」を付ける。
- あわせて、変更箇所・変更内容・作業内容・人数を入力する。
- 提出時は、選んだ工事を A4 の記録用紙 PDF にする（1ページに写真3枚）。
- 現場は複数登録でき、工事は現場の中に複数。出力時に工事を選ぶ（全選択も可）。
- 記録と写真は、各利用者のスマホの中（IndexedDB）にだけ保存。サーバーへは送らない。
- 利用は承認制。管理者（細野）の作業は、申請の承認か却下だけにしたい、という方針。
- 不特定多数の利用者を想定。

## 2. 現在の公開状態（2026-10-15 時点）
- 公開アドレス（利用者に配るもの）: https://kiroku.rccreate.net/
- 旧アドレス https://rccreate-dev.github.io/kiroku-app/ は新アドレスに自動転送される。
- バージョン 1.4.0。Service Worker のキャッシュ名 kiroku-v8。
- 最新コミット: c43e655（写真ライブラリから選ぶ機能）以降。
- リポジトリ: https://github.com/rccreate-dev/kiroku-app（公開。ブランチは main のみ）。
- GitHub Pages: main ブランチ・/(root)・legacy ビルド。Custom domain は kiroku.rccreate.net、Enforce HTTPS 有効。
- ルートの CNAME ファイルは GitHub が自動で作ったもの。**消さないこと。**（末尾改行なし）

## 3. リポジトリの構成
| ファイル | 役割 |
|---|---|
| index.html（約1,070行） | アプリ本体。外部ライブラリなしの素の JavaScript 1ファイル |
| sw.js | Service Worker（stale-while-revalidate） |
| manifest.webmanifest | 名前「追加変更 記録」／短縮名「追加変更記録」／start_url "./"／scope "./"／display standalone／theme・background #1b2a41／アイコン 192(any)・512(any)・512(maskable) |
| icons/ | icon-192.png、icon-512.png、icon-512-maskable.png、apple-touch-icon.png（180px） |
| gas/Code.gs | 承認と意見受付の Google Apps Script のソース写し（実体は Google 上） |
| CNAME | kiroku.rccreate.net |
| README.md | **古いまま（後述 TODO 参照）** |
| HANDOVER.md | このファイル |

### index.html の主な仕様
- 設定 `CONFIG`: APPROVAL_URL（承認サーバー）、MAX_PAGES_PER_PDF=10、VERSION。
- ルーティングはハッシュ方式: #sites、#site/<id>、#edit/<siteId>/<recId|new>、#export/<siteId>、#settings、#feedback。
- IndexedDB 名 `kiroku`（バージョン1）。ストア:
  - sites: {id, name, createdAt}
  - records: {id, siteId, createdAt, updatedAt, location, content, work, people, photos[], draft}
  - kv: キー author、company、approval、deviceId
- photos の要素: {id, blob, kind(着手前/施工中/完了後), shotAt, fileMtime, src('library'|null), memo}
- 画像は長辺1280px・JPEG品質0.8に縮小して保存（processPhoto。EXIF は除去されるので、EXIF 読み取りは縮小前に行う）。
- 人数は 0〜99、0.5刻み、0も可。表示は「1 人」「0.5 人」。
- 入力途中の保存: 写真追加のたびに下書き（draft）として自動保存。下書きは出力対象外。
- `navigator.storage.persist()` を要求している。
- 承認の流れ（gateState）: ok／apply／pending／rejected。承認済みは端末に保存し、起動時にオンラインなら再確認。却下ならブロック。
- PDF:
  - A4の1ページを 794×1123 の canvas に描き、幅1240pxのJPEGにして、自前で組んだ PDF に入れる（SCALE 1240/794）。
  - 配置: SLOT_Y0=168、SLOT_STEP=290、SLOT_H=280。1ページ3段、写真は左、工事内容は右。
  - ヘッダー: 現場名／年月日／会社名／作成者。長いときは文字を15pxから11pxまで縮め、それでも入らなければ省略記号。
  - 年月日は出力した日（「2026年10月14日」形式）。
  - 写真の下に「No.工事番号-写真番号 日付 時刻」。
  - 写真は工事順（着手前→施工中→完了後）、3枚ごとにページ分け。
  - 共有（navigator.share）に備え、PDF は事前に作っておく。
- 出力画面で会社名・作成者を直せる（kv の company・author に保存）。
- 写真ライブラリ機能（最新の追加）:
  - 撮影用 input とは別に、`multiple` の input（libIn）。
  - JPEG の EXIF（DateTimeOriginal）を `readExifDate` で先頭256KBから読む。無い・読めないときはファイルの lastModified、それも無ければ現在時刻。
  - 選んだ写真は lastModified の昇順で追加。
  - 用紙ではライブラリ写真の日付の後に「※」。そのページ下の注記は「日付は撮影時にアプリが記録した日付。※印はライブラリの写真で、写真ファイルに記録された日付」に変わる（hasLib 判定）。
  - **EXIF の読み取りは JPEG のみ。HEIC は lastModified にフォールバック。**
- 意見送信: #feedback。承認サーバーへ GET で action=feedback を送る（本文250文字まで。GET の URL 長のため）。種類は 使いやすさ／不具合／ほしい機能／その他。
- 「ご意見・ご要望を送る」ボタンは、現場一覧画面の下と、設定画面にある。

## 4. 承認サーバー（Google Apps Script）
- 実行 URL（CONFIG.APPROVAL_URL に設定済み）:
  https://script.google.com/macros/s/AKfycbyh77k-hWsUqDc3fJWPlr7BhG6hhX4ReNszEiQrD49UlXyvllTwSGaEcdcS59ofb-ME/exec
- デプロイ: ウェブアプリ。実行ユーザー「自分」（Google Workspace の k-hosono@rccreate.net）。アクセス「全員」。現在バージョン2。
- Apps Script プロジェクト ID: 19ILqUaBgwxjDlUlnb8uKr4pD5TI7WTB0ZMtWuB6C4MKJAJ_3-TBeJBQI（名前は「無題」、単体スクリプト。`SpreadsheetApp.openById` を使用）。
- スプレッドシート ID 1Aul83tA7Y5TkNBRWjEio-pnU3Lwx0I9zHEYcUYOT3w4
  - シート「利用者」: ID、申請日時、氏名、会社名、状態（申請中／承認／却下）、決定日時。
  - シート「意見」: 受付日時、種類、ご意見、氏名、会社名、バージョン、端末ID。最初の意見が届いたときに自動作成。
- action（すべて doGet）:
  - apply、status: アプリが使う。
  - decide: メールのリンクで開く確認ページ（ここでは決定しない）。
  - commit: 確認ページのボタンで実際に決定。メールのリンクを機械が先に開いても勝手に決定されないための2段構え。
  - feedback: **承認済みの端末だけ**が送れる。
- メールの承認リンクは HMAC 署名つき。秘密鍵はスクリプトのプロパティ SECRET に保存（ここには書かない）。
- 申請メールは6時間あたり20通まで（CacheService）。入力値の先頭が = + - @ のときは数式にならないよう空白を足す。
- 管理者通知は `Session.getEffectiveUser()` 宛て。
- 注意: Claude アカウントのメール（k-hosono@rccreate.co.jp）と、Google Workspace のアドレス（rccreate.net）は別。混同しないこと。

### GAS を直すときの手順
1. gas/Code.gs を直す。
2. Apps Script エディタを開く: https://script.google.com/home/projects/19ILqUaBgwxjDlUlnb8uKr4pD5TI7WTB0ZMtWuB6C4MKJAJ_3-TBeJBQI/edit
3. Monaco に貼り付ける（ブラウザ画面では JavaScript の `monaco.editor.getModels()[0].setValue(...)` が確実だった）。
4. 保存（Ctrl+S）。
5. 「デプロイ」→「デプロイを管理」→ 鉛筆（編集）→ バージョン「新バージョン」→「デプロイ」。URL は変わらない。（画面が狭いときは JavaScript でボタンを押した）
6. `?action=feedback&id=x&text=t` を開き、`{"ok":false,"error":"bad_id"}` が返れば新コードが有効。

## 5. ドメインと DNS
- 利用者に配るドメイン: kiroku.rccreate.net（CNAME → rccreate-dev.github.io、TTL 1時間）。
- rccreate.net の登録・DNS は GoDaddy（ネームサーバー ns57/ns58.domaincontrol.com）。**有効期限は 2027-10-19 に更新済み**。
- GoDaddy の操作は、細野本人が自分のブラウザ（Edge）で行った。Claude の組み込みブラウザは Akamai のエラー、Chrome 拡張は未接続で使えなかった。**DNS 変更が必要なら、本人に画面操作してもらい、スクリーンショットで手順を案内する。**
- 参考: rccreate.co.jp（メール用）の DNS は namedserver.net（提供元は未特定）。

## 6. 公開・更新の手順（毎回）
1. index.html などを直す。
2. **sw.js の `CACHE = 'kiroku-v8'` の数字を上げる。**忘れると利用者のスマホが新しい版に替わらない。
3. index.html の `CONFIG.VERSION` を上げる。
4. コミットして `git push origin main`。コミットメッセージは日本語。
5. 反映に数分。確認は `fetch('/index.html?'+Date.now(), {cache:'no-store'})` のように日付つき URL で（CDN のキャッシュに惑わされないため）。
6. 利用者のスマホでは、アプリを閉じて開き直したあとに反映（場合によっては2回目の起動）。

## 7. テストの方法（パソコン上で確認済み）
- `python3 -m http.server 8765 --directory /home/claude/kiroku-app`
- Playwright（Python、Chromium）で `page.route('**/script.google.com/**', ...)` により承認サーバーを模擬。申請→承認→現場追加→工事登録→全選択→PDF 保存まで通せる。
- PDF は pdftoppm で画像化して見た目を確認。QR は qrcode と cv2 で読み取り確認。
- ライブラリ機能は PIL で EXIF 付き JPEG を作り、`input[multiple]` に `set_input_files`。
- テストスクリプトは過去のクラウド一時領域にあり、消えている可能性が高い。必要なら上の方法で作り直す。

## 8. 利用者向け資料（Dropbox）
- 保存先（細野のパソコン）: C:\Users\k-hos\RCCREATE Dropbox\細野功介\※追加変更工事資料作成アプリ
- ファイル: QR_追加変更記録アプリ.png／案内_QR付き.png（A4案内）／URL.txt（いずれも新アドレス）／追加変更記録アプリ_使い方マニュアル.pdf（12ページ、実画面入り、ライブラリ機能の説明含む）。
- パソコンへの書き込みは、Claude デスクトップアプリ連携（device の commit 機能）で行った。連携が切れていると書けない。
- 作成スクリプト（QR・マニュアル・アイコン）はクラウド一時領域にあり、リポジトリには無い。消えていたら次の仕様で作り直す。
  - 案内: 見出し・QR・「スマホのカメラで読み取ってください」・「利用には管理者の承認が必要です」・URL・株式会社RCCREATE。QR は 820px、案内は 1240×1754、フォント NotoSansCJK-Bold。
  - マニュアル: HTML を Playwright で A4 の PDF に。画面写真は Playwright で撮ったアプリのスクリーンショット。
  - 現在のマニュアルの画面写真は、意見ボタン追加前のもの。画面が変わったら更新が必要。

## 9. アイコン
- 追加変更記録アプリ: C案を適用済み。オレンジ(#c2410c)の地に白で「追加」、左上に「RC」、下に紺の帯で「RCCREATE」。「RC」は仮のマーク。公式のロゴ・色の指定があれば差し替える。
- 検査アプリ（rccreate-dev/katawaku-inspection、frontend/icons/、テーマ色 #0c6b67、名前「型枠検査」）用に、緑地に「検査」のアイコン一式（検査アプリ用_C案アイコン.zip）を作って本人に渡した。**検査アプリのリポジトリには書き込み権限がなく、未適用。**
- 適用するには、そのリポジトリへの権限付与が必要。icon-192.png・icon-512.png は上書き、icon-512-maskable.png・apple-touch-icon.png は追加、manifest の修正も必要。

## 10. 未確認・未完了（優先順）
1. **実機での確認がほぼ未実施。** iPhone・Android で、カメラ起動、写真の向き、ライブラリから選ぶ操作（日付が想定どおりか）、PDF の共有・保存、ホーム画面アプリでの動作、意見の送信を確認する。
2. **Android のアイコン**: アイコン変更後にホーム画面から消え、入れ直しても古いアイコンのままだった。新アドレスでの入れ直しの結果は未報告。原因は未確認（Chrome の WebAPK 更新の可能性）。
3. **承認の確認**: テスト申請（氏名「テスト（動作確認）」）が「利用者」シートに残っている可能性。削除は本人が行う。メールの承認フローを実際の Google 上で最後まで通した確認は本人の操作に依存。
4. **組織外の端末からの申請**: ウェブアプリのアクセスは「全員」だが、Workspace 外・未ログインのスマホから申請できるかは未確認。必ず確認する。
5. **バックアップ・復元機能は未実装。**他社に公開する前に必須（本人の方針。本人が追加するとしているが、Claude への正式依頼はまだ。依頼があれば設計から）。記録はスマホ内だけなので、機種変更・データ消去で消える。
6. **README.md の更新**:
   - 公開アドレスが kiroku.rccreate.net であること、CNAME ファイルの扱い。
   - 例にある `kiroku-v2` を最新に。
   - 年月日、会社名の印字、人数0.5刻み、意見ボタン、写真ライブラリ（EXIF と ※）。
   - 承認サーバーが単体スクリプト＋ `openById` であること、「意見」シートの存在。
   - 「確認できていること」「既知の制限」の見直し（古い「アルバムの写真は選べない」等の記述の整理）。
7. HEIC の撮影日時は EXIF を読めずファイルの日時になる。iPhone のライブラリ写真で実際にどう渡るか確認。
8. 意見は250文字まで。長い意見が必要なら POST への変更を検討。
9. Apps Script プロジェクトとスプレッドシートの名前が「無題」。分かりやすい名前に（任意）。
10. マニュアルに「ご意見」ボタンの説明が無い（任意）。

## 11. 別プロジェクト：アプリの販売（売り切り／サブスク）
- 状況: 検討段階で、方式は未決定。**まず自社内で使ってレビューを集め、その後に他社へ公開**する。他社に送る前にバックアップ機能を追加する。公開時は自社ドメインを使う（切り替え済み）。
- 検討資料: https://claude.ai/code/artifact/7a52b426-8ead-4342-b07b-36c27c62d0d0（市場調査、3年試算、販売前に整えること、次のアクション）
- 主な結論（本人の仮定が多く確定ではない）:
  - 競合: 蔵衛門が月660〜1,100円/人（税抜600〜1,000円）、フリープランあり。KANNA は基本無料。
  - 市場: 型枠工の CCUS 登録は80,662人（2026年6月末）。
  - 個人向けの売り切り・サブスクは赤字になりやすく、会社プラン（月3,000円・10人まで）だけが標準シナリオで黒字。価格・獲得コスト・解約率は仮定。
  - 実データを取るため、まず協力会社10〜20社に無料で使ってもらう。
- 販売前の課題:
  - 記録がスマホ内だけで、消えたときの責任が最大のリスク。
  - 課金・解約・ライセンス管理の仕組みが無い。
  - 非公開での配信が必要（今は公開リポジトリ）。
  - GitHub Pages は商用サービス向けの利用を想定しない規約があったと記憶（要確認）。
  - 利用規約、プライバシーポリシー、特定商取引法に基づく表記、インボイス対応、弁護士確認。
  - 「証明になる」と言い切らない表現にする。写真・データの改ざん防止はしていない。

## 12. 環境の落とし穴
- クラウド作業環境のシェルからは、github.io や Google のドメインへ直接アクセスできない（許可リスト制限）。確認はブラウザ画面か Chrome 拡張で。DNS の確認は dns.google と RDAP をブラウザ経由で行った（シェルに dig なし）。
- 組み込みブラウザはサイトごとに本人の許可が必要。GoDaddy は使えなかった。Chrome 拡張は未接続だった。
- gh のトークンが無効で gh の API は使えない。git push は通る。リポジトリ作成・設定変更は、本人のサインイン済みブラウザで行った。
- Claude の GitHub アプリには kiroku-app への権限がある。検査アプリのリポジトリには無い。

## 13. 最初にやること
1. `git pull` して最新（c43e655 以降）か確認。
2. 上の「10. 未確認・未完了」を読み、優先順位を本人と確認。
3. 本人が最初に依頼しそうなこと: 実機確認の進め方、README の更新、バックアップ機能の設計。
