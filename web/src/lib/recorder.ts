// Push-to-talk helper for the P1 mic button: start() asks for the mic and records; stop() resolves to a webm Blob.

export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  cancel(): void;
  readonly recording: boolean;
}

export const recorderSupported = (): boolean =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

function pickMime(): string | undefined {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'])
    if (MediaRecorder.isTypeSupported?.(m)) return m
  return undefined
}

export function createRecorder(): Recorder {
  let stream: MediaStream | null = null
  let rec: MediaRecorder | null = null
  let chunks: Blob[] = []

  const release = () => {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    rec = null
  }

  return {
    get recording() { return rec?.state === 'recording' },

    async start() {
      if (rec) return
      if (!recorderSupported()) throw new Error('Recording is not supported in this browser.')
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMime()
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunks = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      rec.start(250)
    },

    stop() {
      const r = rec
      if (!r) return Promise.reject(new Error('Not recording.'))
      return new Promise<Blob>((resolve, reject) => {
        r.onstop = () => {
          const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' })
          chunks = []
          release()
          if (blob.size === 0) reject(new Error('No audio was captured.'))
          else resolve(blob)
        }
        r.onerror = () => { release(); reject(new Error('Recording failed.')) }
        if (r.state !== 'inactive') r.stop()
        else r.onstop?.(new Event('stop'))
      })
    },

    cancel() {
      if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop() }
      chunks = []
      release()
    },
  }
}
