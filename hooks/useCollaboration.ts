"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { getSupabase } from "@/lib/supabase"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface Collaborator {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: "owner" | "editor" | "viewer"
  isOnline: boolean
  cursor?: { x: number; y: number; page: number }
  lastSeen: number
}

export interface CollaborationSession {
  id: string
  name: string
  ownerId: string
  createdAt: string
  inviteCode?: string
}

interface UseCollaborationProps {
  user: SupabaseUser | null
  sessionId?: string
  onRemoteEdit?: (pageIndex: number, editData: string) => void
  onSendInviteEmail?: (
    recipientEmail: string,
    inviteCode: string,
    sessionName: string,
    inviterName: string
  ) => Promise<boolean>
}

export function useCollaboration({ user, sessionId, onRemoteEdit, onSendInviteEmail }: UseCollaborationProps) {
  const [session, setSession] = useState<CollaborationSession | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Generate a unique invite code
  const generateInviteCode = useCallback(() => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }, [])

  // Create a new collaboration session
  const createSession = useCallback(async (fileName: string) => {
    if (!user) return null

    setIsLoading(true)
    try {
      const newSession: CollaborationSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: fileName,
        ownerId: user.id,
        createdAt: new Date().toISOString(),
        inviteCode: generateInviteCode(),
      }

      // Save session to localStorage for now (can be migrated to Supabase later)
      const sessions = JSON.parse(localStorage.getItem("collab-sessions") || "[]")
      sessions.push(newSession)
      localStorage.setItem("collab-sessions", JSON.stringify(sessions))

      setSession(newSession)

      // Set owner as first collaborator
      setCollaborators([{
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatarUrl: user.user_metadata?.avatar_url,
        role: "owner",
        isOnline: true,
        lastSeen: Date.now(),
      }])

      return newSession
    } finally {
      setIsLoading(false)
    }
  }, [user, generateInviteCode])

  // Join an existing session by invite code
  const joinSession = useCallback(async (inviteCode: string) => {
    if (!user) return false

    setIsLoading(true)
    setInviteError(null)

    try {
      const sessions = JSON.parse(localStorage.getItem("collab-sessions") || "[]")
      const foundSession = sessions.find((s: CollaborationSession) => s.inviteCode === inviteCode)

      if (!foundSession) {
        setInviteError("유효하지 않은 초대 코드입니다.")
        return false
      }

      setSession(foundSession)
      return true
    } catch {
      setInviteError("세션 참여 중 오류가 발생했습니다.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Send invite to email
  const sendInvite = useCallback(async (email: string, role: "editor" | "viewer" = "editor") => {
    if (!session || !user) return false

    setInviteError(null)

    // Add to collaborators list as pending
    const newCollaborator: Collaborator = {
      id: `pending-${Date.now()}`,
      email,
      name: email.split("@")[0],
      role,
      isOnline: false,
      lastSeen: 0,
    }

    // Send invite email if callback is provided
    if (onSendInviteEmail && session.inviteCode) {
      const inviterName = user.user_metadata?.full_name || user.email?.split("@")[0] || "사용자"
      const success = await onSendInviteEmail(
        email,
        session.inviteCode,
        session.name,
        inviterName
      )
      if (!success) {
        setInviteError("초대 이메일 발송에 실패했습니다.")
        return false
      }
    }

    setCollaborators(prev => [...prev, newCollaborator])
    setInviteEmail("")
    setShowInviteDialog(false)

    return true
  }, [session, user, onSendInviteEmail])

  // Subscribe to real-time presence updates
  const subscribeToPresence = useCallback(() => {
    if (!session || !user) return

    const supabase = getSupabase()

    // Create a presence channel for this session
    const channel = supabase.channel(`presence-${session.id}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const onlineUsers = (Object.values(state).flat() as unknown) as Array<{
          id: string
          email: string
          name: string
          avatarUrl?: string
          cursor?: { x: number; y: number; page: number }
        }>

        setCollaborators(prev => prev.map(c => ({
          ...c,
          isOnline: onlineUsers.some(u => u.id === c.id),
          cursor: onlineUsers.find(u => u.id === c.id)?.cursor,
          lastSeen: onlineUsers.some(u => u.id === c.id) ? Date.now() : c.lastSeen,
        })))
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined:", key, newPresences)
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        console.log("User left:", key)
      })
      .on("broadcast", { event: "edit" }, ({ payload }) => {
        if (payload.userId !== user.id && onRemoteEdit) {
          onRemoteEdit(payload.pageIndex, payload.editData)
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split("@")[0],
            avatarUrl: user.user_metadata?.avatar_url,
          })
        }
      })

    channelRef.current = channel

    // Keep presence alive
    presenceIntervalRef.current = setInterval(() => {
      channel.track({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split("@")[0],
        avatarUrl: user.user_metadata?.avatar_url,
      })
    }, 30000) // Every 30 seconds

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current)
      }
      channel.unsubscribe()
    }
  }, [session, user, onRemoteEdit])

  // Broadcast cursor position
  const updateCursor = useCallback((x: number, y: number, page: number) => {
    if (!channelRef.current || !user) return

    channelRef.current.track({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split("@")[0],
      avatarUrl: user.user_metadata?.avatar_url,
      cursor: { x, y, page },
    })
  }, [user])

  // Broadcast edit operation
  const broadcastEdit = useCallback((pageIndex: number, editData: string) => {
    if (!channelRef.current || !user) return

    channelRef.current.send({
      type: "broadcast",
      event: "edit",
      payload: {
        userId: user.id,
        pageIndex,
        editData,
        timestamp: Date.now(),
      },
    })
  }, [user])

  // Copy invite link
  const copyInviteLink = useCallback(() => {
    if (!session?.inviteCode) return

    const link = `${window.location.origin}/convert/ai-edit?invite=${session.inviteCode}`
    navigator.clipboard.writeText(link)
  }, [session])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current)
      }
    }
  }, [])

  // Auto-subscribe when session is active
  useEffect(() => {
    if (session && user) {
      const cleanup = subscribeToPresence()
      return cleanup
    }
  }, [session, user, subscribeToPresence])

  return {
    session,
    collaborators,
    isLoading,
    showInviteDialog,
    setShowInviteDialog,
    inviteEmail,
    setInviteEmail,
    inviteError,
    createSession,
    joinSession,
    sendInvite,
    updateCursor,
    broadcastEdit,
    copyInviteLink,
  }
}
