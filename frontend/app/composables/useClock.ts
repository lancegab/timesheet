interface ClockSession {
  id: string
  clockInAt: string
  elapsedSeconds: number
}

interface AutoClosedSession {
  id: string
  clockInAt: string
  clockOutAt: string
  timeEntryId: string
  hours: number
}

export function useClock() {
  const { apiFetch } = useApi()

  const active = useState<boolean>('clock_active', () => false)
  const session = useState<ClockSession | null>('clock_session', () => null)
  const elapsed = useState<number>('clock_elapsed', () => 0)
  const autoClosedSession = useState<AutoClosedSession | null>('clock_auto_closed', () => null)

  let timerInterval: ReturnType<typeof setInterval> | null = null

  function startTimer() {
    stopTimer()
    timerInterval = setInterval(() => {
      elapsed.value++
    }, 1000)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function formatElapsed(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  async function checkStatus() {
    try {
      const data = await apiFetch<any>('/clock/status')
      if (data.active) {
        active.value = true
        session.value = data.session
        elapsed.value = data.session.elapsedSeconds
        startTimer()
      } else {
        active.value = false
        session.value = null
        elapsed.value = 0
        stopTimer()
        if (data.autoClosedSession) {
          autoClosedSession.value = data.autoClosedSession
        }
      }
    } catch {
      // ignore
    }
  }

  async function clockIn() {
    const data = await apiFetch<any>('/clock/in', { method: 'POST' })
    active.value = true
    session.value = { id: data.id, clockInAt: data.clockInAt, elapsedSeconds: 0 }
    elapsed.value = 0
    startTimer()
  }

  async function clockOut(projectId: string, description: string) {
    const data = await apiFetch<any>('/clock/out', {
      method: 'POST',
      body: JSON.stringify({ projectId, description }),
    })
    active.value = false
    session.value = null
    elapsed.value = 0
    stopTimer()
    return data
  }

  function dismissAutoClosed() {
    autoClosedSession.value = null
  }

  return {
    active,
    session,
    elapsed,
    autoClosedSession,
    formatElapsed,
    checkStatus,
    clockIn,
    clockOut,
    dismissAutoClosed,
  }
}
