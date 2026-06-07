import { playerColor } from '../players/colors'
import { composeName } from '../players/identity'
import { useI18n } from '../i18n/useI18n'
import { offscreenEdgePosition } from '../tabletop/ping'

interface Props {
  /** Active pings (world coords). */
  pings: ReadonlyArray<{ key: string; x: number; y: number; playerId: string }>
  /** Roster, for the pinger's name + color. */
  players: ReadonlyArray<{ id: string; name: string; characterName: string }>
  /** Stage transform (world → screen: world * scale + offset). */
  stageX: number
  stageY: number
  stageScale: number
  /** Canvas size in device px. */
  width: number
  height: number
  /** Inset for the edge arrows so they stay fully visible. */
  margin: number
}

/**
 * Edge arrows for pings that are outside the current viewport — a
 * colored, pulsing chevron pinned to the screen edge, pointing toward
 * the off-screen ping so a participant notices it. Purely a visual cue:
 * `pointer-events: none` (set in CSS) so it never steals clicks from the
 * toolbars / minimap it may overlap — navigation to the ping is via the
 * minimap (which also shows the ping). The arrow is authored pointing
 * east; the wrapper rotates it to the true bearing.
 */
export function OffscreenPingIndicators({
  pings,
  players,
  stageX,
  stageY,
  stageScale,
  width,
  height,
  margin,
}: Props) {
  const { t } = useI18n()
  // Before the stage is measured every point would read as off-screen;
  // skip until there is a real viewport to test against.
  if (width <= 0 || height <= 0) return null
  return (
    <>
      {pings.map((p) => {
        const edge = offscreenEdgePosition(
          p.x * stageScale + stageX,
          p.y * stageScale + stageY,
          width,
          height,
          margin,
        )
        if (!edge) return null
        const pinger = players.find((pl) => pl.id === p.playerId)
        const name = pinger
          ? composeName(pinger.name, pinger.characterName)
          : ''
        // Fall back to the generic tool name when the pinger has already
        // left the room, so the label never reads "Ping from  ".
        const label = name
          ? t('tabletop.tools.pingOffscreen', { name })
          : t('tabletop.tools.ping')
        return (
          <div
            key={`off-${p.key}`}
            className="tabletop-ping-offscreen"
            role="img"
            aria-label={label}
            title={label}
            style={{
              left: `${edge.x}px`,
              top: `${edge.y}px`,
              color: playerColor(p.playerId),
              transform: `translate(-50%, -50%) rotate(${edge.angle}deg)`,
            }}
          >
            <span className="tabletop-ping-offscreen-arrow" />
          </div>
        )
      })}
    </>
  )
}
