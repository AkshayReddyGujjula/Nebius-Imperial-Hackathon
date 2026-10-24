import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { MessageCircleQuestion } from 'lucide-react'
import { useCrux } from '../../store/runStore'
import type { CruxNode } from '../buildGraph'
import { NodeShell } from './NodeShell'

/** The conversation: where the brief's next question lands. */
function ChatOutNodeImpl({ id }: NodeProps<CruxNode>) {
  const last = useCrux((s) => {
    for (let i = s.chat.length - 1; i >= 0; i--) if (s.chat[i].role === 'assistant') return s.chat[i].text
    return null
  })
  return (
    <NodeShell id={id} className="cx-node-chat" label="Conversation">
      <div className="cx-k">
        <MessageCircleQuestion />
        Asks you next
      </div>
      <div className="cx-body cx-clamp-2" style={{ fontSize: 12, lineHeight: '17px' }} title={last ?? undefined}>
        {last ?? <span className="cx-muted">The next question appears here</span>}
      </div>
    </NodeShell>
  )
}

export const ChatOutNode = memo(ChatOutNodeImpl)
