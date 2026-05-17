export const LANGS = ['ja', 'en'] as const
export type Lang = (typeof LANGS)[number]

/** Flat key -> string dictionary. Placeholders use {name} syntax. */
type Dict = Record<string, string>

const ja: Dict = {
  'app.title': 'TRPG オンラインダイス',
  'app.tagline': '仲間とダイスをシェアしよう',
  'lang.label': '言語',

  'settings.title': '設定',
  'settings.open': '設定',
  'settings.close': '閉じる',
  'settings.about': 'このアプリについて',

  'dock.room': 'ルーム',
  'dock.character': 'キャラ',
  'dock.dice': 'ダイス',
  'dock.patterns': 'パターン',

  'status.offline': 'オフライン',
  'status.noCharacter': 'PL 本人',

  'gate.start': 'はじめる',
  'gate.nameHint': 'プレイヤー名は設定からいつでも変更できます。',

  'settings.help': '使い方を見る',
  'tutorial.skip': 'スキップ',
  'tutorial.next': '次へ',
  'tutorial.back': '戻る',
  'tutorial.done': 'はじめる',
  'tutorial.welcome.title': 'TRPG オンラインダイスへようこそ',
  'tutorial.welcome.body':
    '仲間とダイスを振り、出目・履歴・チャットをリアルタイムに共有できます。',
  'tutorial.dice.title': 'ダイスを振る',
  'tutorial.dice.body':
    '画面下のドックの「ダイス」から、個数・種類・補正・用途を選んで振ります。出目は履歴に残ります。',
  'tutorial.character.title': 'キャラクター',
  'tutorial.character.body':
    '「キャラ」からキャラクターを作成・切り替えできます。キャラクターとして振ると、名前に（プレイヤー名）が付きます。',
  'tutorial.patterns.title': 'パターン',
  'tutorial.patterns.body':
    'よく使うダイスの組み合わせは「パターン」に名前を付けて保存し、ワンタップで振れます。',
  'tutorial.room.title': 'ルームで共有',
  'tutorial.room.body':
    '「ルーム」からルームを作成（GM になる）するか、コードを入力して参加します。履歴・チャット・参加者が全員に共有されます。',
  'tutorial.settings.title': '設定とヘルプ',
  'tutorial.settings.body':
    'プレイヤー名や言語の変更、このガイドの再表示は、右上の設定（⚙）から行えます。',

  'player.section': 'プレイヤー',
  'player.name': 'プレイヤー名',
  'player.namePlaceholder': 'あなたの名前',
  'player.anon': '名無し',

  'character.section': 'キャラクター',
  'character.activeLabel': '操作するキャラクター',
  'character.asPlayer': 'キャラクターなし（PL 本人）',
  'character.create': '新しいキャラクター',
  'character.empty': 'キャラクターがまだありません。作成してみましょう。',
  'character.name': 'キャラクター名',
  'character.namePlaceholder': '例: 戦士ガロン',
  'character.background': '背景情報（ルーム内に公開）',
  'character.backgroundPlaceholder': '種族・職業・経歴など、他の人に見せる情報',
  'character.memo': 'メモ（自分だけが見られる）',
  'character.memoPlaceholder': '自分用のメモ。共有されません',
  'character.details': 'キャラクター詳細',
  'character.delete': 'このキャラクターを削除',
  'character.deleteConfirm': 'キャラクター「{name}」を削除します。元に戻せません。よろしいですか？',
  'character.export': '書き出し',
  'character.exportMemo': 'メモも書き出しに含める',
  'character.import': '読み込み',
  'character.importError': 'キャラクターを読み込めませんでした。ファイルを確認してください。',
  'character.unnamed': '無名のキャラクター',
  'character.actingAs': '{name} として操作中',

  'dice.section': 'ダイスを振る',
  'dice.count': '個数',
  'dice.type': '種類',
  'dice.modifier': '補正',
  'dice.modifierDec': '補正を下げる',
  'dice.modifierInc': '補正を上げる',
  'dice.kind': '用途',
  'kind.damage': 'ダメージ',
  'kind.judgment': '判定',

  'pattern.section': '保存したパターン',
  'pattern.name': 'パターン名',
  'pattern.namePlaceholder': '例: 火球の魔法',
  'pattern.save': 'このパターンを保存',
  'pattern.load': '呼び出す',
  'pattern.roll': '振る',
  'pattern.moveUp': '上へ移動',
  'pattern.moveDown': '下へ移動',
  'pattern.delete': '削除',
  'pattern.deleteConfirm': 'パターン「{name}」を削除します。元に戻せません。よろしいですか？',
  'pattern.none': '保存されたパターンはありません',
  'pattern.unnamed': '無名のパターン',
  'pattern.needName': 'パターン名を入力してください',
  'pattern.needCharacter': 'パターンの保存にはキャラクターを選択してください',

  'roll.button': 'ダイスを振る',
  'roll.hidden': '隠しロール（GM）',
  'roll.hiddenHint': 'ON にすると、あなたのロールは出目を伏せて他プレイヤーに通知されます',

  'result.damage': '{value}ダメージ',
  'result.damageNamed': '{name} {value}ダメージ',
  'result.judgment': '{name} 判定の結果 {value}',
  'result.hiddenRoll': '{name} が隠しロールを行いました',
  'result.faces': '出目内訳',

  'feed.section': '履歴 & チャット',
  'feed.all': 'すべて',
  'feed.rolls': '履歴',
  'feed.chat': 'チャット',
  'feed.empty': 'まだ何もありません',
  'feed.clear': '表示をクリア',
  'feed.clearConfirm': '履歴とチャットの表示をすべてクリアします。元に戻せません。よろしいですか？',

  'typing.one': '{names} が入力中…',
  'typing.many': '{names} が入力中…',

  'marker.created': 'ルーム {code} を作成しました',
  'marker.joined': 'ルーム {code} に参加しました',
  'marker.youLeft': 'ルームを退出しました',
  'marker.youClosed': 'ルームを閉じました',
  'marker.gmClosed': 'GM がルームを閉じました',
  'marker.hostLost': 'GM との接続が切れました',
  'marker.playerJoined': '{name} が参加しました',
  'marker.playerLeft': '{name} が退出しました',

  'room.section': 'ルーム',
  'room.offline': 'オフライン（あなただけ）',
  'room.name': 'ルーム名',
  'room.namePlaceholder': '例: 金曜の冒険',
  'room.create': 'ルームを作成（GM になる）',
  'room.join': 'ルームに参加',
  'room.codePlaceholder': 'ルームコード',
  'room.code': 'ルームコード',
  'room.copy': 'コードをコピー',
  'room.copied': 'コピーしました',
  'room.leave': 'ルームを退出',
  'room.leaveConfirmGM': 'ルームを閉じると、参加者全員がオフラインになります。よろしいですか？',
  'room.connecting': '接続中…',
  'room.connected': '接続済み',
  'room.players': '参加者',
  'room.gmBadge': 'GM',
  'room.youBadge': 'あなた',
  'room.shareHint': 'このコードを仲間に共有してください',
  'room.error': '接続に失敗しました。コードを確認してください。',
  'room.hostLost': 'GM との接続が切れました。',

  'chat.placeholder': 'メッセージを入力',
  'chat.send': '送信',

  'common.you': 'あなた',
}

const en: Dict = {
  'app.title': 'TRPG Online Dice',
  'app.tagline': 'Roll dice together with your party',
  'lang.label': 'Language',

  'settings.title': 'Settings',
  'settings.open': 'Settings',
  'settings.close': 'Close',
  'settings.about': 'About',

  'dock.room': 'Room',
  'dock.character': 'Character',
  'dock.dice': 'Dice',
  'dock.patterns': 'Patterns',

  'status.offline': 'Offline',
  'status.noCharacter': 'As player',

  'gate.start': 'Start',
  'gate.nameHint': 'You can change your player name anytime in Settings.',

  'settings.help': 'How to use',
  'tutorial.skip': 'Skip',
  'tutorial.next': 'Next',
  'tutorial.back': 'Back',
  'tutorial.done': 'Get started',
  'tutorial.welcome.title': 'Welcome to TRPG Online Dice',
  'tutorial.welcome.body':
    'Roll dice with your party and share results, history and chat in real time.',
  'tutorial.dice.title': 'Roll dice',
  'tutorial.dice.body':
    'Open "Dice" in the bottom dock, pick the count, type, modifier and kind, then roll. Every roll is kept in the history.',
  'tutorial.character.title': 'Characters',
  'tutorial.character.body':
    'Open "Character" to create and switch characters. Rolling as a character shows your name as "Character（Player）".',
  'tutorial.patterns.title': 'Patterns',
  'tutorial.patterns.body':
    'Save dice combinations you use often as named "Patterns" and roll them with one tap.',
  'tutorial.room.title': 'Share in a room',
  'tutorial.room.body':
    'From "Room", create a room (as GM) or join one with a code. History, chat and the player list are shared with everyone.',
  'tutorial.settings.title': 'Settings & help',
  'tutorial.settings.body':
    'Change your player name or language, and reopen this guide, from Settings (⚙) at the top right.',

  'player.section': 'Player',
  'player.name': 'Player name',
  'player.namePlaceholder': 'Your name',
  'player.anon': 'Anonymous',

  'character.section': 'Character',
  'character.activeLabel': 'Active character',
  'character.asPlayer': 'No character (as yourself)',
  'character.create': 'New character',
  'character.empty': 'No characters yet. Create one to get started.',
  'character.name': 'Character name',
  'character.namePlaceholder': 'e.g. Garon the warrior',
  'character.background': 'Background (shared with the room)',
  'character.backgroundPlaceholder': 'Race, class, history — anything others may see',
  'character.memo': 'Memo (only you can see this)',
  'character.memoPlaceholder': 'Private notes — never shared',
  'character.details': 'Character details',
  'character.delete': 'Delete this character',
  'character.deleteConfirm': 'Delete the character "{name}"? This cannot be undone.',
  'character.export': 'Export',
  'character.exportMemo': 'Include the memo in the export',
  'character.import': 'Import',
  'character.importError': 'Could not import the character. Please check the file.',
  'character.unnamed': 'Unnamed character',
  'character.actingAs': 'Acting as {name}',

  'dice.section': 'Roll dice',
  'dice.count': 'Count',
  'dice.type': 'Type',
  'dice.modifier': 'Modifier',
  'dice.modifierDec': 'Decrease modifier',
  'dice.modifierInc': 'Increase modifier',
  'dice.kind': 'Kind',
  'kind.damage': 'Damage',
  'kind.judgment': 'Judgment',

  'pattern.section': 'Saved patterns',
  'pattern.name': 'Pattern name',
  'pattern.namePlaceholder': 'e.g. Fireball spell',
  'pattern.save': 'Save this pattern',
  'pattern.load': 'Load',
  'pattern.roll': 'Roll',
  'pattern.moveUp': 'Move up',
  'pattern.moveDown': 'Move down',
  'pattern.delete': 'Delete',
  'pattern.deleteConfirm': 'Delete the pattern "{name}"? This cannot be undone.',
  'pattern.none': 'No saved patterns yet',
  'pattern.unnamed': 'Unnamed pattern',
  'pattern.needName': 'Please enter a pattern name',
  'pattern.needCharacter': 'Select a character to save patterns',

  'roll.button': 'Roll the dice',
  'roll.hidden': 'Hidden roll (GM)',
  'roll.hiddenHint': 'When on, your rolls are sent to other players with the value hidden',

  'result.damage': '{value} damage',
  'result.damageNamed': '{name}: {value} damage',
  'result.judgment': 'Result of {name} check: {value}',
  'result.hiddenRoll': '{name} made a hidden roll',
  'result.faces': 'Dice faces',

  'feed.section': 'History & Chat',
  'feed.all': 'All',
  'feed.rolls': 'Rolls',
  'feed.chat': 'Chat',
  'feed.empty': 'Nothing here yet',
  'feed.clear': 'Clear view',
  'feed.clearConfirm': 'This clears all rolls and chat from your view and cannot be undone. Continue?',

  'typing.one': '{names} is typing…',
  'typing.many': '{names} are typing…',

  'marker.created': 'Created room {code}',
  'marker.joined': 'Joined room {code}',
  'marker.youLeft': 'You left the room',
  'marker.youClosed': 'You closed the room',
  'marker.gmClosed': 'The GM closed the room',
  'marker.hostLost': 'Lost connection to the GM',
  'marker.playerJoined': '{name} joined',
  'marker.playerLeft': '{name} left',

  'room.section': 'Room',
  'room.offline': 'Offline (just you)',
  'room.name': 'Room name',
  'room.namePlaceholder': 'e.g. Friday adventure',
  'room.create': 'Create room (become GM)',
  'room.join': 'Join room',
  'room.codePlaceholder': 'Room code',
  'room.code': 'Room code',
  'room.copy': 'Copy code',
  'room.copied': 'Copied',
  'room.leave': 'Leave room',
  'room.leaveConfirmGM': 'Closing the room will take every player offline. Continue?',
  'room.connecting': 'Connecting…',
  'room.connected': 'Connected',
  'room.players': 'Players',
  'room.gmBadge': 'GM',
  'room.youBadge': 'You',
  'room.shareHint': 'Share this code with your party',
  'room.error': 'Failed to connect. Please check the code.',
  'room.hostLost': 'Lost connection to the GM.',

  'chat.placeholder': 'Type a message',
  'chat.send': 'Send',

  'common.you': 'You',
}

export const TRANSLATIONS: Record<Lang, Dict> = { ja, en }

/** Look up a key for a language and interpolate {placeholder} params. */
export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = TRANSLATIONS[lang][key] ?? TRANSLATIONS.en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}
