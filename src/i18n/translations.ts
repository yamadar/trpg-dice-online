export const LANGS = ['ja', 'en'] as const
export type Lang = (typeof LANGS)[number]

/** Flat key -> string dictionary. Placeholders use {name} syntax. */
type Dict = Record<string, string>

const ja: Dict = {
  'app.title': 'TRPG オンラインダイス',
  'app.tagline': '仲間とダイスをシェアしよう',
  'lang.label': '言語',

  'player.section': 'プレイヤー',
  'player.name': '名前',
  'player.namePlaceholder': '名前を入力',

  'dice.section': 'ダイスを振る',
  'dice.count': '個数',
  'dice.type': '種類',
  'dice.modifier': '補正',
  'dice.kind': '用途',
  'kind.damage': 'ダメージ',
  'kind.judgment': '判定',

  'pattern.section': '保存したパターン',
  'pattern.name': 'パターン名',
  'pattern.namePlaceholder': '例: 火球の魔法',
  'pattern.save': 'このパターンを保存',
  'pattern.load': '呼び出す',
  'pattern.delete': '削除',
  'pattern.none': '保存されたパターンはありません',
  'pattern.unnamed': '無名のパターン',
  'pattern.needName': 'パターン名を入力してください',

  'roll.button': 'ダイスを振る',
  'roll.hidden': '隠しロール（GM）',
  'roll.hiddenHint': 'ON にすると、あなたのロールは出目を伏せて他プレイヤーに通知されます',
  'roll.summary': '{count}{type} 補正 {modifier}',

  'result.damage': '{value} ダメージ',
  'result.judgment': '{name} 判定の結果 {value}',
  'result.hiddenRoll': '{name} が隠しロールを行いました',
  'result.faces': '出目内訳',

  'history.section': 'ロール履歴',
  'history.empty': 'まだロールがありません',
  'history.clear': '履歴をクリア',

  'room.section': 'ルーム',
  'room.offline': 'オフライン（あなただけ）',
  'room.create': 'ルームを作成（GM になる）',
  'room.join': 'ルームに参加',
  'room.codePlaceholder': 'ルームコード',
  'room.code': 'ルームコード',
  'room.copy': 'コードをコピー',
  'room.copied': 'コピーしました',
  'room.leave': 'ルームを退出',
  'room.connecting': '接続中…',
  'room.connected': '接続済み',
  'room.players': '参加者',
  'room.gmBadge': 'GM',
  'room.youBadge': 'あなた',
  'room.shareHint': 'このコードを仲間に共有してください',
  'room.error': '接続に失敗しました。コードを確認してください。',
  'room.hostLost': 'GM との接続が切れました。ルームを退出します。',

  'chat.section': 'チャット',
  'chat.placeholder': 'メッセージを入力',
  'chat.send': '送信',
  'chat.empty': 'メッセージはありません',

  'common.you': 'あなた',
}

const en: Dict = {
  'app.title': 'TRPG Online Dice',
  'app.tagline': 'Roll dice together with your party',
  'lang.label': 'Language',

  'player.section': 'Player',
  'player.name': 'Name',
  'player.namePlaceholder': 'Enter your name',

  'dice.section': 'Roll dice',
  'dice.count': 'Count',
  'dice.type': 'Type',
  'dice.modifier': 'Modifier',
  'dice.kind': 'Kind',
  'kind.damage': 'Damage',
  'kind.judgment': 'Judgment',

  'pattern.section': 'Saved patterns',
  'pattern.name': 'Pattern name',
  'pattern.namePlaceholder': 'e.g. Fireball spell',
  'pattern.save': 'Save this pattern',
  'pattern.load': 'Load',
  'pattern.delete': 'Delete',
  'pattern.none': 'No saved patterns yet',
  'pattern.unnamed': 'Unnamed pattern',
  'pattern.needName': 'Please enter a pattern name',

  'roll.button': 'Roll the dice',
  'roll.hidden': 'Hidden roll (GM)',
  'roll.hiddenHint': 'When on, your rolls are sent to other players with the value hidden',
  'roll.summary': '{count}{type}, modifier {modifier}',

  'result.damage': '{value} damage',
  'result.judgment': 'Result of {name} check: {value}',
  'result.hiddenRoll': '{name} made a hidden roll',
  'result.faces': 'Dice faces',

  'history.section': 'Roll history',
  'history.empty': 'No rolls yet',
  'history.clear': 'Clear history',

  'room.section': 'Room',
  'room.offline': 'Offline (just you)',
  'room.create': 'Create room (become GM)',
  'room.join': 'Join room',
  'room.codePlaceholder': 'Room code',
  'room.code': 'Room code',
  'room.copy': 'Copy code',
  'room.copied': 'Copied',
  'room.leave': 'Leave room',
  'room.connecting': 'Connecting…',
  'room.connected': 'Connected',
  'room.players': 'Players',
  'room.gmBadge': 'GM',
  'room.youBadge': 'You',
  'room.shareHint': 'Share this code with your party',
  'room.error': 'Failed to connect. Please check the code.',
  'room.hostLost': 'Lost connection to the GM. Leaving the room.',

  'chat.section': 'Chat',
  'chat.placeholder': 'Type a message',
  'chat.send': 'Send',
  'chat.empty': 'No messages yet',

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
