interface ClockSession {
  id: string
  clockInAt: string
  projectId: string
  projectName: string
  segmentStartAt: string
  workType: string
  description: string | null
  elapsedSeconds: number
  segmentSeconds: number
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
  const segmentElapsed = useState<number>('clock_segment_elapsed', () => 0)
  const autoClosedSession = useState<AutoClosedSession | null>('clock_auto_closed', () => null)
  const notes = useState<string[]>('clock_notes', () => [])
  const notesSaveStatus = useState<'saved' | 'saving' | 'error'>('clock_notes_status', () => 'saved')

  let timerInterval: ReturnType<typeof setInterval> | null = null
  let notesSaveInterval: ReturnType<typeof setInterval> | null = null

  function recalcElapsed() {
    if (!session.value) return
    const now = Date.now()
    elapsed.value = Math.floor((now - new Date(session.value.clockInAt).getTime()) / 1000)
    segmentElapsed.value = Math.floor((now - new Date(session.value.segmentStartAt).getTime()) / 1000)
  }

  function startTimer() {
    stopTimer()
    recalcElapsed()
    timerInterval = setInterval(recalcElapsed, 1000)
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

  let notesDirty = false

  async function saveNotes() {
    const description = notes.value.join('\n')
    notesSaveStatus.value = 'saving'
    try {
      await apiFetch('/clock/notes', {
        method: 'PUT',
        body: JSON.stringify({ description }),
      })
      notesSaveStatus.value = 'saved'
      notesDirty = false
    } catch {
      notesSaveStatus.value = 'error'
    }
  }

  function startNotesSaveInterval() {
    stopNotesSaveInterval()
    notesSaveInterval = setInterval(() => {
      if (notesDirty && active.value) {
        saveNotes()
      }
    }, 60 * 1000)
  }

  function stopNotesSaveInterval() {
    if (notesSaveInterval) {
      clearInterval(notesSaveInterval)
      notesSaveInterval = null
    }
  }

  function addNote(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    notes.value = [...notes.value, trimmed]
    notesDirty = true
    saveNotes()
  }

  function removeNote(index: number) {
    notes.value = notes.value.filter((_, i) => i !== index)
    notesDirty = true
    saveNotes()
  }

  function retrySaveNotes() {
    if (notesSaveStatus.value === 'error') {
      saveNotes()
    }
  }

  function getDescription(): string {
    return notes.value.join('\n')
  }

  async function checkStatus() {
    try {
      const data = await apiFetch<any>('/clock/status')
      if (data.active) {
        active.value = true
        session.value = data.session
        if (data.session.description) {
          notes.value = data.session.description.split('\n').filter(Boolean)
        } else {
          notes.value = []
        }
        notesSaveStatus.value = 'saved'
        notesDirty = false
        startTimer()
        startNotesSaveInterval()
      } else {
        active.value = false
        session.value = null
        elapsed.value = 0
        segmentElapsed.value = 0
        notes.value = []
        notesSaveStatus.value = 'saved'
        stopTimer()
        stopNotesSaveInterval()
        if (data.autoClosedSession) {
          autoClosedSession.value = data.autoClosedSession
        }
      }
    } catch {
      // ignore
    }
  }

  async function clockIn(projectId: string, workType: string = 'DEVELOPMENT') {
    const data = await apiFetch<any>('/clock/in', {
      method: 'POST',
      body: JSON.stringify({ projectId, workType }),
    })
    active.value = true
    session.value = {
      id: data.id,
      clockInAt: data.clockInAt,
      projectId: data.projectId,
      projectName: '',
      segmentStartAt: data.clockInAt,
      workType: data.workType || workType,
      description: null,
      elapsedSeconds: 0,
      segmentSeconds: 0,
    }
    notes.value = []
    notesSaveStatus.value = 'saved'
    startTimer()
    startNotesSaveInterval()
  }

  async function switchProject(projectId: string, description: string, workType?: string) {
    const data = await apiFetch<any>('/clock/switch', {
      method: 'POST',
      body: JSON.stringify({ projectId, description, workType }),
    })
    await checkStatus()
    return data
  }

  async function clockOut(description: string) {
    const data = await apiFetch<any>('/clock/out', {
      method: 'POST',
      body: JSON.stringify({ description }),
    })
    active.value = false
    session.value = null
    elapsed.value = 0
    segmentElapsed.value = 0
    stopTimer()
    stopNotesSaveInterval()
    return data
  }

  function dismissAutoClosed() {
    autoClosedSession.value = null
  }

  return {
    active,
    session,
    elapsed,
    segmentElapsed,
    autoClosedSession,
    notes,
    notesSaveStatus,
    formatElapsed,
    checkStatus,
    clockIn,
    switchProject,
    clockOut,
    dismissAutoClosed,
    addNote,
    removeNote,
    retrySaveNotes,
    getDescription,
  }
}
