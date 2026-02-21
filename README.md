# AI Page Summarizer - Chrome Extension

Webページの内容を抽出し、ローカルで動作するAIを使って要約・分析を行うChrome拡張機能です。

## 機能

- **右クリックメニューからAI分析** — ページ全体またはテキスト選択部分を右クリックメニューから簡単にAIへ送信できます
- **システムプロンプトの管理** — 用途に応じた複数のシステムプロンプトを登録・切り替え可能です
- **ストリーミングなしのシンプル応答** — AIからの応答をMarkdownとして整形表示します
- **コンテンツ抽出のカスタマイズ** — 不要なHTML要素（広告、ナビゲーション等）をタグ名やCSSセレクタで除外できます
- **抽出テキストの編集** — 送信前に抽出されたテキストを画面上で直接編集できます
- **クリップボードコピー** — 抽出テキスト・AI応答のそれぞれをワンクリックでコピーできます

## AIバックエンド

本拡張機能は **Ollama** の `/api/generate` エンドポイントを利用してAI推論を行います。

### Ollama

[Ollama](https://ollama.com/) はローカル環境でLLMを手軽に実行できるツールです。

#### インストール

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# macOS (Homebrew)
brew install ollama
```

Windows の場合は [公式サイト](https://ollama.com/download) からインストーラをダウンロードしてください。

#### モデルの準備と起動

```bash
# モデルをダウンロード（例: llama3）
ollama pull llama3

# Ollamaサーバーを起動（デフォルトで http://localhost:11434 で待ち受け）
ollama serve
```

サーバーが起動すると、拡張機能からデフォルト設定のまま利用できます。

### OpenAI互換エンドポイント

本拡張機能は Ollama の `/api/generate` エンドポイント形式（`model`, `prompt`, `system` パラメータによるJSON POST）で通信します。そのため、**同じリクエスト形式に対応した OpenAI互換のエンドポイント** であれば、Ollama以外のサービスでも利用可能です。

設定画面で **Host** 欄にエンドポイントのURLを、**Model** 欄に使用するモデル名を指定してください。

## インストール方法

1. このリポジトリをクローンまたはダウンロードします
2. Chrome で `chrome://extensions/` を開きます
3. 右上の **「デベロッパー モード」** を有効にします
4. **「パッケージ化されていない拡張機能を読み込む」** をクリックし、`chrome_extension-ai_summary` フォルダを選択します

## 使い方

### 1. 初期設定

拡張機能インストール後、設定画面を開きます（拡張機能アイコンを右クリック → 「オプション」）。

- **Ollama Host** — Ollamaサーバーのアドレス（デフォルト: `http://localhost:11434`）
- **Ollama Model** — 使用するモデル名（例: `llama3`）
- **Ignore HTML Tags** — 抽出時に除外するHTMLタグ（カンマ区切り）
- **Ignore CSS Selectors** — 抽出時に除外するCSSセレクタ（カンマ区切り）
- **System Prompts** — AIに与えるシステムプロンプトを追加・削除。デフォルトプロンプトをラジオボタンで選択可能

### 2. ページを要約する

1. 要約したいWebページ上で **右クリック** → **「Summarize with AI」** を選択
2. 新しいタブに要約画面が開き、ページの抽出テキストが左側に表示されます
3. ドロップダウンからシステムプロンプトを選択し、**「Run AI Analysis」** をクリック
4. AIの応答が右側にMarkdown整形されて表示されます

テキストを選択した状態で右クリックすると、選択部分のみがAIに送信されます。

デフォルトプロンプトが設定されている場合は、画面を開いた時点で自動的にAI分析が実行されます。

## ファイル構成

| ファイル | 説明 |
|---|---|
| `manifest.json` | Chrome拡張のマニフェスト（Manifest V3） |
| `background.js` | サービスワーカー。コンテキストメニュー登録とページコンテンツ抽出 |
| `summary.html` | AI要約画面のHTML |
| `summary.js` | AI要約画面のロジック。Ollama APIとの通信・Markdownレンダリング |
| `options.html` | 設定画面のHTML |
| `options.js` | 設定画面のロジック。プロンプト管理・設定の保存 |
| `styles.css` | 共通スタイルシート |
| `test/logic_test.js` | コンテンツ抽出ロジックのユニットテスト |

## テスト

```bash
cd test
node logic_test.js
```

> テストには `jsdom` パッケージが必要です（`npm install jsdom`）。

## 必要な権限

| 権限 | 用途 |
|---|---|
| `contextMenus` | 右クリックメニューへの項目追加 |
| `scripting` | ページへのコンテンツスクリプト注入 |
| `activeTab` | 現在のタブへのアクセス |
| `storage` | 設定・抽出テキストの保存 |
| `tabs` | タブ情報の取得 |

## ライセンス

MIT
