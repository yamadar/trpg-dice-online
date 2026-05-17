import { useI18n } from '../i18n/useI18n'

interface Props {
  name: string
  onChangeName: (name: string) => void
}

export function PlayerBar({ name, onChangeName }: Props) {
  const { t } = useI18n()
  return (
    <section className="panel">
      <h2>{t('player.section')}</h2>
      <label className="field">
        <span>{t('player.name')}</span>
        <input
          type="text"
          value={name}
          maxLength={24}
          placeholder={t('player.namePlaceholder')}
          onChange={(e) => onChangeName(e.target.value)}
        />
      </label>
    </section>
  )
}
