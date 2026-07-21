import { NextResponse } from 'next/server'
import { setScoreBroadcastCallback, type ScoreUpdate } from '@/lib/scoring'

const subscribers = new Set<(update: ScoreUpdate) => void>()

export async function GET() {
  const encoder = new TextEncoder()
  let sendUpdate: ((update: ScoreUpdate) => void) | null = null
  
  const stream = new ReadableStream({
    start(controller) {
      sendUpdate = (update: ScoreUpdate) => {
        try {
          const data = `data: ${JSON.stringify(update)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch (error) {
          console.error('[SSE] Error sending update:', error)
        }
      }
      
      subscribers.add(sendUpdate)
      
      controller.enqueue(encoder.encode(': connected\n\n'))
    },
    
    cancel() {
      if (sendUpdate) {
        subscribers.delete(sendUpdate)
      }
    }
  })
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

setScoreBroadcastCallback((update: ScoreUpdate) => {
  subscribers.forEach(callback => {
    try {
      callback(update)
    } catch (error) {
      console.error('[SSE] Error in subscriber callback:', error)
    }
  })
})