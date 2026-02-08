"use client"

import { useState } from "react"
import { X, Users, UserPlus, Copy, Check, Mail, Link2, Crown, Eye, Edit3 } from "lucide-react"
import type { Collaborator, CollaborationSession } from "@/hooks/useCollaboration"

interface CollaborationPanelProps {
  session: CollaborationSession | null
  collaborators: Collaborator[]
  showInviteDialog: boolean
  setShowInviteDialog: (show: boolean) => void
  inviteEmail: string
  setInviteEmail: (email: string) => void
  inviteError: string | null
  onCreateSession: (fileName: string) => Promise<CollaborationSession | null>
  onSendInvite: (email: string, role?: "editor" | "viewer") => Promise<boolean>
  onCopyInviteLink: () => void
  fileName: string
  isOwner: boolean
}

export function CollaborationPanel({
  session,
  collaborators,
  showInviteDialog,
  setShowInviteDialog,
  inviteEmail,
  setInviteEmail,
  inviteError,
  onCreateSession,
  onSendInvite,
  onCopyInviteLink,
  fileName,
  isOwner,
}: CollaborationPanelProps) {
  const [copied, setCopied] = useState(false)
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")

  const handleCopyLink = () => {
    onCopyInviteLink()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return
    await onSendInvite(inviteEmail, inviteRole)
  }

  const handleStartCollaboration = async () => {
    if (!session) {
      await onCreateSession(fileName)
    }
    setShowInviteDialog(true)
  }

  const onlineCount = collaborators.filter(c => c.isOnline).length

  return (
    <>
      {/* Collaboration Button / Avatar Stack */}
      <div className="relative">
        {session ? (
          <button
            onClick={() => setShowInviteDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 text-xs rounded-lg transition-colors"
          >
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {collaborators.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className={`w-6 h-6 rounded-full border-2 border-purple-600/50 flex items-center justify-center text-[10px] font-bold ${
                    c.isOnline ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-background" : ""
                  }`}
                  style={{ backgroundColor: c.avatarUrl ? undefined : stringToColor(c.email) }}
                  title={`${c.name} ${c.isOnline ? "(온라인)" : "(오프라인)"}`}
                >
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={c.name} className="w-full h-full rounded-full" />
                  ) : (
                    c.name.charAt(0).toUpperCase()
                  )}
                </div>
              ))}
              {collaborators.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-secondary border-2 border-purple-600/50 flex items-center justify-center text-[10px] font-medium">
                  +{collaborators.length - 3}
                </div>
              )}
            </div>
            <span>{onlineCount}명 온라인</span>
          </button>
        ) : (
          <button
            onClick={handleStartCollaboration}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs rounded-lg transition-colors"
            title="공동 작업 시작"
          >
            <Users className="w-3.5 h-3.5" />
            공동 작업
          </button>
        )}
      </div>

      {/* Invite Dialog */}
      {showInviteDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold">공동 작업</h3>
              </div>
              <button
                onClick={() => setShowInviteDialog(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Invite Link */}
              {session?.inviteCode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">초대 링크</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/convert/ai-edit?invite=${session.inviteCode}`}
                      className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-muted-foreground truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "복사됨" : "복사"}
                    </button>
                  </div>
                </div>
              )}

              {/* Email Invite */}
              {isOwner && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">이메일로 초대</label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                        className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      >
                        <option value="editor">편집자</option>
                        <option value="viewer">뷰어</option>
                      </select>
                    </div>
                    <button
                      onClick={handleSendInvite}
                      disabled={!inviteEmail.trim()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      초대
                    </button>
                  </div>
                  {inviteError && (
                    <p className="text-xs text-red-500">{inviteError}</p>
                  )}
                </div>
              )}

              {/* Collaborators List */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">참여자 ({collaborators.length})</label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {collaborators.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ backgroundColor: c.avatarUrl ? undefined : stringToColor(c.email) }}
                          >
                            {c.avatarUrl ? (
                              <img src={c.avatarUrl} alt={c.name} className="w-full h-full rounded-full" />
                            ) : (
                              c.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          {c.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            {c.name}
                            {c.role === "owner" && <Crown className="w-3 h-3 text-yellow-500" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.role === "owner" ? "bg-yellow-500/20 text-yellow-500" :
                          c.role === "editor" ? "bg-purple-500/20 text-purple-500" :
                          "bg-blue-500/20 text-blue-500"
                        }`}>
                          {c.role === "owner" ? (
                            <span className="flex items-center gap-1"><Crown className="w-3 h-3" /> 소유자</span>
                          ) : c.role === "editor" ? (
                            <span className="flex items-center gap-1"><Edit3 className="w-3 h-3" /> 편집자</span>
                          ) : (
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> 뷰어</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Helper function to generate consistent colors from strings
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 50%)`
}
