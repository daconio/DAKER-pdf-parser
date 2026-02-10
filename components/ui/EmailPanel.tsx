"use client"

import { useState, useEffect, useCallback } from "react"
import {
  X,
  Mail,
  Send,
  Paperclip,
  Trash2,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  ChevronLeft,
  Users,
  Search,
  UserPlus,
  Edit2,
  Check,
  Book,
  Upload,
  EyeOff,
  Copy,
  Scissors,
  Clipboard,
  Undo,
  Redo,
} from "lucide-react"
import type { EmailHistoryItem } from "@/hooks/useEmail"
import type { EmailContact, AddContactParams } from "@/hooks/useEmailContacts"
import type { EmailTemplate, AddTemplateParams } from "@/hooks/useEmailTemplates"
import { EmailTemplateManager } from "./EmailTemplateManager"

interface EmailPanelProps {
  isOpen: boolean
  onClose: () => void
  emails: EmailHistoryItem[]
  loading: boolean
  sending: boolean
  error: string | null
  onSendEmail: (params: {
    to: string[]
    subject: string
    htmlBody?: string
    textBody?: string
  }) => Promise<boolean>
  onSendPdfEmail?: (
    recipients: string[],
    subject: string,
    body: string
  ) => Promise<boolean>
  onDeleteEmail: (emailId: string) => Promise<boolean>
  onFetchEmails: () => Promise<void>
  pdfAvailable?: boolean
  pdfFileName?: string
  inline?: boolean
  // Contact management props
  contacts?: EmailContact[]
  contactGroups?: string[]
  contactsLoading?: boolean
  contactsError?: string | null
  onFetchContacts?: (group?: string, search?: string) => Promise<void>
  onAddContact?: (contact: AddContactParams) => Promise<boolean>
  onAddBulkContacts?: (contacts: AddContactParams[]) => Promise<{ success: boolean; count: number }>
  onUpdateContact?: (id: string, updates: Partial<Omit<EmailContact, "id" | "user_id" | "created_at">>) => Promise<boolean>
  onDeleteContacts?: (ids: string[]) => Promise<boolean>
  onParseCSV?: (csvText: string, groupName?: string) => AddContactParams[]
  // Template management props
  templates?: EmailTemplate[]
  templatesLoading?: boolean
  templatesError?: string | null
  templateClipboard?: EmailTemplate | null
  canUndoTemplate?: boolean
  canRedoTemplate?: boolean
  onFetchTemplates?: (type?: EmailTemplate["type"]) => Promise<void>
  onAddTemplate?: (template: AddTemplateParams) => Promise<boolean>
  onUpdateTemplate?: (id: string, updates: Partial<Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">>) => Promise<boolean>
  onDeleteTemplates?: (ids: string[]) => Promise<boolean>
  onReorderTemplates?: (updates: Array<{ id: string; sort_order: number }>) => Promise<boolean>
  onSetDefaultTemplate?: (id: string) => Promise<boolean>
  onDuplicateTemplate?: (id: string) => Promise<boolean>
  onUndoTemplate?: () => Promise<void>
  onRedoTemplate?: () => Promise<void>
  onCopyTemplate?: (id: string) => void
  onCutTemplate?: (id: string) => Promise<boolean>
  onPasteTemplate?: () => Promise<boolean>
  getDefaultTemplate?: (type: EmailTemplate["type"]) => EmailTemplate | undefined
}

type PanelView = "list" | "compose" | "contacts" | "templates" | "bcc"

export function EmailPanel({
  isOpen,
  onClose,
  emails,
  loading,
  sending,
  error,
  onSendEmail,
  onSendPdfEmail,
  onDeleteEmail,
  onFetchEmails,
  pdfAvailable = false,
  pdfFileName,
  inline = false,
  // Contact props
  contacts = [],
  contactGroups = [],
  contactsLoading = false,
  contactsError,
  onFetchContacts,
  onAddContact,
  onAddBulkContacts,
  onUpdateContact,
  onDeleteContacts,
  onParseCSV,
  // Template props
  templates = [],
  templatesLoading = false,
  templatesError,
  templateClipboard,
  canUndoTemplate = false,
  canRedoTemplate = false,
  onFetchTemplates,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplates,
  onReorderTemplates,
  onSetDefaultTemplate,
  onDuplicateTemplate,
  onUndoTemplate,
  onRedoTemplate,
  onCopyTemplate,
  onCutTemplate,
  onPasteTemplate,
  getDefaultTemplate,
}: EmailPanelProps) {
  const [view, setView] = useState<PanelView>("list")
  const [recipients, setRecipients] = useState("")
  const [ccRecipients, setCcRecipients] = useState("")
  const [bccRecipients, setBccRecipients] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [attachPdf, setAttachPdf] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Contact management state
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("all")
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [showAddContact, setShowAddContact] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [newContactEmail, setNewContactEmail] = useState("")
  const [newContactName, setNewContactName] = useState("")
  const [newContactGroup, setNewContactGroup] = useState("default")
  const [bulkImportText, setBulkImportText] = useState("")
  const [bulkImportGroup, setBulkImportGroup] = useState("default")
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editingContactData, setEditingContactData] = useState<{ email: string; name: string; group_name: string } | null>(null)
  const [addToField, setAddToField] = useState<"to" | "cc" | "bcc">("to")

  // Email history editing state (click subject to edit)
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
  const [editingEmailSubject, setEditingEmailSubject] = useState("")

  // Selected header/footer templates for compose
  const [selectedHeader, setSelectedHeader] = useState<EmailTemplate | null>(null)
  const [selectedFooter, setSelectedFooter] = useState<EmailTemplate | null>(null)

  // Subject editing mode in compose (click to toggle)
  const [isSubjectEditing, setIsSubjectEditing] = useState(true)

  // BCC management state
  const [bccSearchQuery, setBccSearchQuery] = useState("")
  const [selectedBccContacts, setSelectedBccContacts] = useState<Set<string>>(new Set())
  const [showAddBcc, setShowAddBcc] = useState(false)
  const [showBulkBccImport, setShowBulkBccImport] = useState(false)
  const [newBccEmail, setNewBccEmail] = useState("")
  const [newBccName, setNewBccName] = useState("")
  const [bulkBccImportText, setBulkBccImportText] = useState("")
  const [editingBccId, setEditingBccId] = useState<string | null>(null)
  const [editingBccData, setEditingBccData] = useState<{ email: string; name: string } | null>(null)
  const [bccClipboard, setBccClipboard] = useState<EmailContact | null>(null)
  const [bccUndoStack, setBccUndoStack] = useState<EmailContact[][]>([])
  const [bccRedoStack, setBccRedoStack] = useState<EmailContact[][]>([])

  // Get BCC contacts (filtered by "bcc" group)
  const bccContacts = contacts.filter(c => c.group_name === "bcc")

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Cancel editing
        if (editingEmailId) {
          setEditingEmailId(null)
          setEditingEmailSubject("")
          return
        }
        if (editingContactId) {
          setEditingContactId(null)
          setEditingContactData(null)
          return
        }
        if (editingBccId) {
          setEditingBccId(null)
          setEditingBccData(null)
          return
        }
        // Disable subject editing mode in compose
        if (view === "compose" && isSubjectEditing) {
          setIsSubjectEditing(false)
          return
        }
        // Close panel if in list view
        if (view === "list") {
          onClose()
        } else {
          setView("list")
        }
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, view, editingEmailId, editingContactId, editingBccId, isSubjectEditing, onClose])

  // Fetch emails when panel opens
  useEffect(() => {
    if (isOpen) {
      onFetchEmails()
    }
  }, [isOpen, onFetchEmails])

  // Fetch contacts when contacts view is opened
  useEffect(() => {
    if (view === "contacts" && onFetchContacts) {
      onFetchContacts(selectedGroup, searchQuery)
    }
  }, [view, selectedGroup, searchQuery, onFetchContacts])

  // Fetch templates when templates view is opened
  useEffect(() => {
    if (view === "templates" && onFetchTemplates) {
      onFetchTemplates()
    }
  }, [view, onFetchTemplates])

  // Reset form when view changes
  useEffect(() => {
    if (view === "compose") {
      setRecipients("")
      setCcRecipients("")
      setBccRecipients("")
      setShowCcBcc(false)
      setSubject("")
      // Apply default header/footer templates if available
      if (getDefaultTemplate) {
        const header = getDefaultTemplate("header")
        const footer = getDefaultTemplate("footer")
        setSelectedHeader(header || null)
        setSelectedFooter(footer || null)
        // Pre-fill body with header + footer
        let defaultBody = ""
        if (header) defaultBody += header.content + "\n\n"
        defaultBody += "\n\n"
        if (footer) defaultBody += footer.content
        setBody(defaultBody.trim() ? defaultBody : "")
      } else {
        setBody("")
      }
      setAttachPdf(false)
      setLocalError(null)
    }
    if (view === "contacts") {
      setSelectedContacts(new Set())
      setEditingContactId(null)
      setShowAddContact(false)
      setShowBulkImport(false)
    }
    if (view === "list") {
      setEditingEmailId(null)
      setEditingEmailSubject("")
    }
  }, [view, getDefaultTemplate])

  const handleSend = async () => {
    setLocalError(null)

    // Validate
    const toList = recipients.split(",").map((e) => e.trim()).filter(Boolean)
    if (toList.length === 0) {
      setLocalError("수신자 이메일을 입력해주세요.")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of toList) {
      if (!emailRegex.test(email)) {
        setLocalError(`올바르지 않은 이메일 형식: ${email}`)
        return
      }
    }

    if (!subject.trim()) {
      setLocalError("제목을 입력해주세요.")
      return
    }

    let success: boolean
    if (attachPdf && onSendPdfEmail) {
      success = await onSendPdfEmail(toList, subject, body)
    } else {
      success = await onSendEmail({
        to: toList,
        subject,
        htmlBody: body.replace(/\n/g, "<br>"),
        textBody: body,
      })
    }

    if (success) {
      setView("list")
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    } else if (days === 1) {
      return "어제"
    } else if (days < 7) {
      return `${days}일 전`
    } else {
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    }
  }

  // Contact management handlers
  const handleAddContact = async () => {
    if (!onAddContact || !newContactEmail.trim()) return

    const success = await onAddContact({
      email: newContactEmail,
      name: newContactName || undefined,
      group_name: newContactGroup,
    })

    if (success) {
      setNewContactEmail("")
      setNewContactName("")
      setNewContactGroup("default")
      setShowAddContact(false)
    }
  }

  const handleBulkImport = async () => {
    if (!onAddBulkContacts || !onParseCSV || !bulkImportText.trim()) return

    const contactsToAdd = onParseCSV(bulkImportText, bulkImportGroup)
    if (contactsToAdd.length === 0) {
      setLocalError("유효한 이메일이 없습니다.")
      return
    }

    const result = await onAddBulkContacts(contactsToAdd)
    if (result.success) {
      setBulkImportText("")
      setBulkImportGroup("default")
      setShowBulkImport(false)
      setLocalError(null)
    }
  }

  const handleUpdateContact = async () => {
    if (!onUpdateContact || !editingContactId || !editingContactData) return

    const success = await onUpdateContact(editingContactId, {
      email: editingContactData.email,
      name: editingContactData.name || null,
      group_name: editingContactData.group_name,
    })

    if (success) {
      setEditingContactId(null)
      setEditingContactData(null)
    }
  }

  const handleDeleteSelectedContacts = async () => {
    if (!onDeleteContacts || selectedContacts.size === 0) return

    const success = await onDeleteContacts(Array.from(selectedContacts))
    if (success) {
      setSelectedContacts(new Set())
    }
  }

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contactId)) {
        newSet.delete(contactId)
      } else {
        newSet.add(contactId)
      }
      return newSet
    })
  }

  const addSelectedContactsToField = useCallback(() => {
    const selectedEmails = contacts
      .filter(c => selectedContacts.has(c.id))
      .map(c => c.email)

    if (selectedEmails.length === 0) return

    const emailString = selectedEmails.join(", ")

    switch (addToField) {
      case "to":
        setRecipients(prev => prev ? `${prev}, ${emailString}` : emailString)
        break
      case "cc":
        setCcRecipients(prev => prev ? `${prev}, ${emailString}` : emailString)
        if (!showCcBcc) setShowCcBcc(true)
        break
      case "bcc":
        setBccRecipients(prev => prev ? `${prev}, ${emailString}` : emailString)
        if (!showCcBcc) setShowCcBcc(true)
        break
    }

    setSelectedContacts(new Set())
    setView("compose")
  }, [contacts, selectedContacts, addToField, showCcBcc])

  const selectAllContacts = () => {
    setSelectedContacts(new Set(contacts.map(c => c.id)))
  }

  const clearSelection = () => {
    setSelectedContacts(new Set())
  }

  // BCC management handlers
  const pushBccUndo = useCallback(() => {
    setBccUndoStack(prev => [...prev.slice(-19), bccContacts])
    setBccRedoStack([])
  }, [bccContacts])

  const handleAddBcc = async () => {
    if (!onAddContact || !newBccEmail.trim()) return

    pushBccUndo()
    const success = await onAddContact({
      email: newBccEmail,
      name: newBccName || undefined,
      group_name: "bcc",
    })

    if (success) {
      setNewBccEmail("")
      setNewBccName("")
      setShowAddBcc(false)
    }
  }

  const handleBulkBccImport = async () => {
    if (!onAddBulkContacts || !onParseCSV || !bulkBccImportText.trim()) return

    const contactsToAdd = onParseCSV(bulkBccImportText, "bcc")
    if (contactsToAdd.length === 0) {
      setLocalError("유효한 이메일이 없습니다.")
      return
    }

    pushBccUndo()
    const result = await onAddBulkContacts(contactsToAdd)
    if (result.success) {
      setBulkBccImportText("")
      setShowBulkBccImport(false)
      setLocalError(null)
    }
  }

  const handleUpdateBcc = async () => {
    if (!onUpdateContact || !editingBccId || !editingBccData) return

    pushBccUndo()
    const success = await onUpdateContact(editingBccId, {
      email: editingBccData.email,
      name: editingBccData.name || null,
      group_name: "bcc",
    })

    if (success) {
      setEditingBccId(null)
      setEditingBccData(null)
    }
  }

  const handleDeleteSelectedBcc = async () => {
    if (!onDeleteContacts || selectedBccContacts.size === 0) return

    pushBccUndo()
    const success = await onDeleteContacts(Array.from(selectedBccContacts))
    if (success) {
      setSelectedBccContacts(new Set())
    }
  }

  const toggleBccSelection = (contactId: string) => {
    setSelectedBccContacts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contactId)) {
        newSet.delete(contactId)
      } else {
        newSet.add(contactId)
      }
      return newSet
    })
  }

  const addSelectedBccToField = useCallback(() => {
    const selectedEmails = bccContacts
      .filter(c => selectedBccContacts.has(c.id))
      .map(c => c.email)

    if (selectedEmails.length === 0) return

    const emailString = selectedEmails.join(", ")
    setBccRecipients(prev => prev ? `${prev}, ${emailString}` : emailString)
    if (!showCcBcc) setShowCcBcc(true)

    setSelectedBccContacts(new Set())
    setView("compose")
  }, [bccContacts, selectedBccContacts, showCcBcc])

  const selectAllBcc = () => {
    setSelectedBccContacts(new Set(bccContacts.map(c => c.id)))
  }

  const clearBccSelection = () => {
    setSelectedBccContacts(new Set())
  }

  // BCC clipboard operations
  const copyBcc = (id: string) => {
    const contact = bccContacts.find(c => c.id === id)
    if (contact) {
      setBccClipboard({ ...contact })
    }
  }

  const cutBcc = async (id: string) => {
    const contact = bccContacts.find(c => c.id === id)
    if (contact && onDeleteContacts) {
      setBccClipboard({ ...contact })
      pushBccUndo()
      await onDeleteContacts([id])
    }
  }

  const pasteBcc = async () => {
    if (!bccClipboard || !onAddContact) return

    pushBccUndo()
    await onAddContact({
      email: bccClipboard.email,
      name: bccClipboard.name || undefined,
      group_name: "bcc",
    })
  }

  // BCC undo/redo (local state only - for UI feedback)
  const undoBcc = useCallback(() => {
    if (bccUndoStack.length === 0) return
    setBccRedoStack(prev => [...prev, bccContacts])
    setBccUndoStack(prev => prev.slice(0, -1))
    // Note: Actual undo would require server-side support
    // This is UI state management only
  }, [bccUndoStack, bccContacts])

  const redoBcc = useCallback(() => {
    if (bccRedoStack.length === 0) return
    setBccUndoStack(prev => [...prev, bccContacts])
    setBccRedoStack(prev => prev.slice(0, -1))
  }, [bccRedoStack, bccContacts])

  if (!isOpen) return null

  // Contacts View Component
  const ContactsView = () => (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="all">전체 그룹</option>
          {contactGroups.map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            추가
          </button>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            대량 등록
          </button>
        </div>
        {selectedContacts.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedContacts.size}개 선택
            </span>
            <select
              value={addToField}
              onChange={(e) => setAddToField(e.target.value as "to" | "cc" | "bcc")}
              className="px-2 py-1 bg-secondary border border-border rounded text-xs"
            >
              <option value="to">받는 사람</option>
              <option value="cc">참조</option>
              <option value="bcc">숨은참조</option>
            </select>
            <button
              onClick={addSelectedContactsToField}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
              추가
            </button>
            <button
              onClick={handleDeleteSelectedContacts}
              className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              삭제
            </button>
          </div>
        )}
      </div>

      {/* Add Contact Form */}
      {showAddContact && (
        <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
          <h4 className="text-sm font-medium">새 연락처 추가</h4>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder="이메일 *"
              className="col-span-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="이름 (선택)"
              className="col-span-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <input
              type="text"
              value={newContactGroup}
              onChange={(e) => setNewContactGroup(e.target.value)}
              placeholder="그룹"
              className="col-span-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddContact(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleAddContact}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* Bulk Import Form */}
      {showBulkImport && (
        <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
          <h4 className="text-sm font-medium">대량 이메일 등록</h4>
          <p className="text-xs text-muted-foreground">
            한 줄에 하나씩 입력하세요. 형식: 이메일, 이름 (이름은 선택)
          </p>
          <textarea
            value={bulkImportText}
            onChange={(e) => setBulkImportText(e.target.value)}
            placeholder="user1@example.com, 홍길동&#10;user2@example.com&#10;user3@example.com, 김철수"
            rows={5}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none font-mono"
          />
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={bulkImportGroup}
              onChange={(e) => setBulkImportGroup(e.target.value)}
              placeholder="그룹명"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <button
              onClick={() => setShowBulkImport(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleBulkImport}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              등록
            </button>
          </div>
        </div>
      )}

      {/* Selection Controls */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={selectAllContacts} className="text-indigo-500 hover:text-indigo-400">
          전체 선택
        </button>
        <span className="text-muted-foreground">|</span>
        <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground">
          선택 해제
        </button>
      </div>

      {/* Contact List */}
      {contactsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">저장된 연락처가 없습니다</p>
          <button
            onClick={() => setShowAddContact(true)}
            className="mt-4 text-indigo-500 hover:text-indigo-400 text-sm font-medium"
          >
            첫 연락처 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className={`group flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                selectedContacts.has(contact.id)
                  ? "bg-indigo-500/10 border border-indigo-500/30"
                  : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
              }`}
              onClick={() => {
                if (editingContactId !== contact.id) {
                  toggleContactSelection(contact.id)
                }
              }}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedContacts.has(contact.id)
                    ? "bg-indigo-600 border-indigo-600"
                    : "border-border"
                }`}
              >
                {selectedContacts.has(contact.id) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>

              {/* Contact Info */}
              {editingContactId === contact.id && editingContactData ? (
                <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="email"
                    value={editingContactData.email}
                    onChange={(e) => setEditingContactData({ ...editingContactData, email: e.target.value })}
                    className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                  <input
                    type="text"
                    value={editingContactData.name}
                    onChange={(e) => setEditingContactData({ ...editingContactData, name: e.target.value })}
                    placeholder="이름"
                    className="w-24 px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                  <input
                    type="text"
                    value={editingContactData.group_name}
                    onChange={(e) => setEditingContactData({ ...editingContactData, group_name: e.target.value })}
                    placeholder="그룹"
                    className="w-20 px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                  <button
                    onClick={handleUpdateContact}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingContactId(null)
                      setEditingContactData(null)
                    }}
                    className="p-1.5 bg-secondary hover:bg-secondary/80 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {contact.name || contact.email}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
                        {contact.group_name}
                      </span>
                    </div>
                    {contact.name && (
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingContactId(contact.id)
                        setEditingContactData({
                          email: contact.email,
                          name: contact.name || "",
                          group_name: contact.group_name,
                        })
                      }}
                      className="p-1.5 hover:bg-secondary rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {(localError || contactsError) && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {localError || contactsError}
        </div>
      )}
    </div>
  )

  // BCC View Component
  const BccView = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={bccSearchQuery}
            onChange={(e) => setBccSearchQuery(e.target.value)}
            placeholder="BCC 이메일 검색..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddBcc(!showAddBcc)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            추가
          </button>
          <button
            onClick={() => setShowBulkBccImport(!showBulkBccImport)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            대량 등록
          </button>
          {bccClipboard && (
            <button
              onClick={pasteBcc}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors"
              title="붙여넣기"
            >
              <Clipboard className="w-4 h-4" />
              붙여넣기
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undoBcc}
            disabled={bccUndoStack.length === 0}
            className="p-1.5 hover:bg-secondary rounded transition-colors disabled:opacity-30"
            title="실행 취소"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redoBcc}
            disabled={bccRedoStack.length === 0}
            className="p-1.5 hover:bg-secondary rounded transition-colors disabled:opacity-30"
            title="다시 실행"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Actions */}
      {selectedBccContacts.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
          <span className="text-sm text-muted-foreground">{selectedBccContacts.size}개 선택</span>
          {selectedBccContacts.size === 1 && (
            <>
              <button
                onClick={() => copyBcc(Array.from(selectedBccContacts)[0])}
                className="p-1.5 hover:bg-secondary rounded transition-colors"
                title="복사"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => cutBcc(Array.from(selectedBccContacts)[0])}
                className="p-1.5 hover:bg-secondary rounded transition-colors"
                title="잘라내기"
              >
                <Scissors className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={addSelectedBccToField}
            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            BCC에 추가
          </button>
          <button
            onClick={handleDeleteSelectedBcc}
            className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            삭제
          </button>
        </div>
      )}

      {/* Add BCC Form */}
      {showAddBcc && (
        <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
          <h4 className="text-sm font-medium">새 BCC 이메일 추가</h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              value={newBccEmail}
              onChange={(e) => setNewBccEmail(e.target.value)}
              placeholder="이메일 *"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <input
              type="text"
              value={newBccName}
              onChange={(e) => setNewBccName(e.target.value)}
              placeholder="이름 (선택)"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddBcc(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleAddBcc}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* Bulk Import Form */}
      {showBulkBccImport && (
        <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
          <h4 className="text-sm font-medium">대량 BCC 이메일 등록</h4>
          <p className="text-xs text-muted-foreground">
            한 줄에 하나씩 입력하세요. 형식: 이메일, 이름 (이름은 선택)
          </p>
          <textarea
            value={bulkBccImportText}
            onChange={(e) => setBulkBccImportText(e.target.value)}
            placeholder="user1@example.com, 홍길동&#10;user2@example.com&#10;user3@example.com, 김철수"
            rows={5}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBulkBccImport(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleBulkBccImport}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              등록
            </button>
          </div>
        </div>
      )}

      {/* Selection Controls */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={selectAllBcc} className="text-indigo-500 hover:text-indigo-400">
          전체 선택
        </button>
        <span className="text-muted-foreground">|</span>
        <button onClick={clearBccSelection} className="text-muted-foreground hover:text-foreground">
          선택 해제
        </button>
      </div>

      {/* BCC List */}
      {contactsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : bccContacts.length === 0 ? (
        <div className="text-center py-12">
          <EyeOff className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">저장된 BCC 이메일이 없습니다</p>
          <button
            onClick={() => setShowAddBcc(true)}
            className="mt-4 text-indigo-500 hover:text-indigo-400 text-sm font-medium"
          >
            첫 BCC 이메일 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {bccContacts
            .filter(c => !bccSearchQuery || c.email.includes(bccSearchQuery) || (c.name && c.name.includes(bccSearchQuery)))
            .map((contact) => (
            <div
              key={contact.id}
              className={`group flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                selectedBccContacts.has(contact.id)
                  ? "bg-indigo-500/10 border border-indigo-500/30"
                  : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
              }`}
              onClick={() => {
                if (editingBccId !== contact.id) {
                  toggleBccSelection(contact.id)
                }
              }}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedBccContacts.has(contact.id)
                    ? "bg-indigo-600 border-indigo-600"
                    : "border-border"
                }`}
              >
                {selectedBccContacts.has(contact.id) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>

              {/* BCC Info */}
              {editingBccId === contact.id && editingBccData ? (
                <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="email"
                    value={editingBccData.email}
                    onChange={(e) => setEditingBccData({ ...editingBccData, email: e.target.value })}
                    className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                  <input
                    type="text"
                    value={editingBccData.name}
                    onChange={(e) => setEditingBccData({ ...editingBccData, name: e.target.value })}
                    placeholder="이름"
                    className="w-24 px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                  <button
                    onClick={handleUpdateBcc}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingBccId(null)
                      setEditingBccData(null)
                    }}
                    className="p-1.5 bg-secondary hover:bg-secondary/80 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {contact.name || contact.email}
                    </span>
                    {contact.name && (
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        copyBcc(contact.id)
                      }}
                      className="p-1.5 hover:bg-secondary rounded transition-colors"
                      title="복사"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingBccId(contact.id)
                        setEditingBccData({
                          email: contact.email,
                          name: contact.name || "",
                        })
                      }}
                      className="p-1.5 hover:bg-secondary rounded transition-colors"
                      title="편집"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {localError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {localError}
        </div>
      )}
    </div>
  )

  // Inline mode: render directly in content area
  if (inline) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {(view === "compose" || view === "contacts" || view === "templates" || view === "bcc") && (
              <button
                onClick={() => setView("list")}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <Mail className="w-6 h-6 text-indigo-500" />
            <h2 className="text-2xl font-bold">
              {view === "list" ? "이메일" : view === "compose" ? "새 이메일 작성" : view === "contacts" ? "주소록" : view === "templates" ? "템플릿" : "BCC 관리"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <>
                <button
                  onClick={() => setView("contacts")}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded-lg transition-colors"
                >
                  <Book className="w-4 h-4" />
                  주소록
                </button>
                {onFetchTemplates && (
                  <button
                    onClick={() => setView("templates")}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    템플릿
                  </button>
                )}
                <button
                  onClick={() => setView("bcc")}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded-lg transition-colors"
                >
                  <EyeOff className="w-4 h-4" />
                  BCC
                </button>
                <button
                  onClick={() => setView("compose")}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  새 이메일
                </button>
              </>
            )}
            {view === "bcc" && selectedBccContacts.size > 0 && (
              <button
                onClick={addSelectedBccToField}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4" />
                BCC에 추가
              </button>
            )}
            {view === "contacts" && selectedContacts.size > 0 && (
              <button
                onClick={() => setView("compose")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4" />
                이메일 작성
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-6">
            {view === "list" ? (
              // Email List View
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  </div>
                ) : emails.length === 0 ? (
                  <div className="text-center py-16">
                    <Mail className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-lg text-muted-foreground mb-2">발송한 이메일이 없습니다</p>
                    <button
                      onClick={() => setView("compose")}
                      className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      첫 이메일 보내기
                    </button>
                  </div>
                ) : (
                  emails.map((email) => (
                    <div
                      key={email.id}
                      className="group flex items-start gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {email.status === "sent" ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : email.status === "failed" ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-medium text-foreground truncate">
                            {email.subject}
                          </span>
                          {email.has_attachment && (
                            <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span className="truncate">
                            {email.recipients.join(", ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(email.sent_at)}
                        </span>
                        <button
                          onClick={() => onDeleteEmail(email.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : view === "contacts" ? (
              // Contacts View
              <ContactsView />
            ) : view === "templates" ? (
              // Templates View
              onFetchTemplates && onAddTemplate && onUpdateTemplate && onDeleteTemplates && onReorderTemplates && onSetDefaultTemplate && onDuplicateTemplate && onUndoTemplate && onRedoTemplate && onCopyTemplate && onCutTemplate && onPasteTemplate ? (
                <EmailTemplateManager
                  templates={templates}
                  loading={templatesLoading}
                  error={templatesError || null}
                  clipboard={templateClipboard || null}
                  canUndo={canUndoTemplate}
                  canRedo={canRedoTemplate}
                  onFetchTemplates={onFetchTemplates}
                  onAddTemplate={onAddTemplate}
                  onUpdateTemplate={onUpdateTemplate}
                  onDeleteTemplates={onDeleteTemplates}
                  onReorderTemplates={onReorderTemplates}
                  onSetDefaultTemplate={onSetDefaultTemplate}
                  onDuplicateTemplate={onDuplicateTemplate}
                  onUndo={onUndoTemplate}
                  onRedo={onRedoTemplate}
                  onCopyTemplate={onCopyTemplate}
                  onCutTemplate={onCutTemplate}
                  onPasteTemplate={onPasteTemplate}
                  mode="manage"
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  템플릿 기능을 사용할 수 없습니다
                </div>
              )
            ) : view === "bcc" ? (
              // BCC View
              <BccView />
            ) : (
              // Compose View
              <div className="space-y-5">
                {/* Recipients */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-muted-foreground">
                      받는 사람 <span className="text-xs text-muted-foreground">(쉼표로 구분)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAddToField("to")
                          setView("contacts")
                        }}
                        className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                      >
                        <Book className="w-3 h-3" />
                        주소록
                      </button>
                      {!showCcBcc && (
                        <>
                          <span className="text-muted-foreground">|</span>
                          <button
                            type="button"
                            onClick={() => setShowCcBcc(true)}
                            className="text-xs text-indigo-500 hover:text-indigo-400"
                          >
                            참조/숨은참조 추가
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="email@example.com, email2@example.com"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                {/* CC/BCC Fields */}
                {showCcBcc && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                          참조 (CC)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAddToField("cc")
                            setView("contacts")
                          }}
                          className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                        >
                          <Book className="w-3 h-3" />
                          주소록
                        </button>
                      </div>
                      <input
                        type="text"
                        value={ccRecipients}
                        onChange={(e) => setCcRecipients(e.target.value)}
                        placeholder="참조할 이메일 주소"
                        className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                          숨은참조 (BCC)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAddToField("bcc")
                            setView("contacts")
                          }}
                          className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                        >
                          <Book className="w-3 h-3" />
                          주소록
                        </button>
                      </div>
                      <input
                        type="text"
                        value={bccRecipients}
                        onChange={(e) => setBccRecipients(e.target.value)}
                        placeholder="숨은참조할 이메일 주소"
                        className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                  </>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    제목
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="이메일 제목을 입력하세요"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    내용
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="이메일 내용을 입력하세요"
                    rows={8}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                  />
                </div>

                {/* PDF Attachment Option */}
                {pdfAvailable && onSendPdfEmail && (
                  <label className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border cursor-pointer hover:border-indigo-500/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={attachPdf}
                      onChange={(e) => setAttachPdf(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">PDF 첨부</span>
                      {pdfFileName && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({pdfFileName})
                        </span>
                      )}
                    </div>
                  </label>
                )}

                {/* Error */}
                {(localError || error) && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    {localError || error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    onClick={() => setView("list")}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    발송
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Modal mode (original)
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {(view === "compose" || view === "contacts" || view === "templates" || view === "bcc") && (
              <button
                onClick={() => setView("list")}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <Mail className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold">
              {view === "list" ? "이메일" : view === "compose" ? "새 이메일 작성" : view === "contacts" ? "주소록" : view === "templates" ? "템플릿" : "BCC 관리"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <>
                <button
                  onClick={() => setView("contacts")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded-lg transition-colors"
                >
                  <Book className="w-4 h-4" />
                  주소록
                </button>
                {onFetchTemplates && (
                  <button
                    onClick={() => setView("templates")}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    템플릿
                  </button>
                )}
                <button
                  onClick={() => setView("bcc")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded-lg transition-colors"
                >
                  <EyeOff className="w-4 h-4" />
                  BCC
                </button>
                <button
                  onClick={() => setView("compose")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  새 이메일
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === "list" ? (
            // Email List View
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">발송한 이메일이 없습니다</p>
                  <button
                    onClick={() => setView("compose")}
                    className="mt-4 text-indigo-500 hover:text-indigo-400 text-sm font-medium"
                  >
                    첫 이메일 보내기
                  </button>
                </div>
              ) : (
                emails.map((email) => (
                  <div
                    key={email.id}
                    className="group flex items-start gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {email.status === "sent" ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : email.status === "failed" ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {email.subject}
                        </span>
                        {email.has_attachment && (
                          <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span className="truncate">
                          {email.recipients.join(", ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(email.sent_at)}
                      </span>
                      <button
                        onClick={() => onDeleteEmail(email.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : view === "contacts" ? (
            // Contacts View
            <ContactsView />
          ) : view === "templates" ? (
            // Templates View
            onFetchTemplates && onAddTemplate && onUpdateTemplate && onDeleteTemplates && onReorderTemplates && onSetDefaultTemplate && onDuplicateTemplate && onUndoTemplate && onRedoTemplate && onCopyTemplate && onCutTemplate && onPasteTemplate ? (
              <EmailTemplateManager
                templates={templates}
                loading={templatesLoading}
                error={templatesError || null}
                clipboard={templateClipboard || null}
                canUndo={canUndoTemplate}
                canRedo={canRedoTemplate}
                onFetchTemplates={onFetchTemplates}
                onAddTemplate={onAddTemplate}
                onUpdateTemplate={onUpdateTemplate}
                onDeleteTemplates={onDeleteTemplates}
                onReorderTemplates={onReorderTemplates}
                onSetDefaultTemplate={onSetDefaultTemplate}
                onDuplicateTemplate={onDuplicateTemplate}
                onUndo={onUndoTemplate}
                onRedo={onRedoTemplate}
                onCopyTemplate={onCopyTemplate}
                onCutTemplate={onCutTemplate}
                onPasteTemplate={onPasteTemplate}
                mode="manage"
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                템플릿 기능을 사용할 수 없습니다
              </div>
            )
          ) : view === "bcc" ? (
            // BCC View
            <BccView />
          ) : (
            // Compose View
            <div className="space-y-4">
              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    받는 사람 <span className="text-xs text-muted-foreground">(쉼표로 구분)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddToField("to")
                        setView("contacts")
                      }}
                      className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                    >
                      <Book className="w-3 h-3" />
                      주소록
                    </button>
                    {!showCcBcc && (
                      <>
                        <span className="text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={() => setShowCcBcc(true)}
                          className="text-xs text-indigo-500 hover:text-indigo-400"
                        >
                          참조/숨은참조
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="email@example.com, email2@example.com"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* CC/BCC Fields */}
              {showCcBcc && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-muted-foreground">
                        참조 (CC)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddToField("cc")
                          setView("contacts")
                        }}
                        className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                      >
                        <Book className="w-3 h-3" />
                        주소록
                      </button>
                    </div>
                    <input
                      type="text"
                      value={ccRecipients}
                      onChange={(e) => setCcRecipients(e.target.value)}
                      placeholder="참조할 이메일 주소"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-muted-foreground">
                        숨은참조 (BCC)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddToField("bcc")
                          setView("contacts")
                        }}
                        className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                      >
                        <Book className="w-3 h-3" />
                        주소록
                      </button>
                    </div>
                    <input
                      type="text"
                      value={bccRecipients}
                      onChange={(e) => setBccRecipients(e.target.value)}
                      placeholder="숨은참조할 이메일 주소"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  제목
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="이메일 제목을 입력하세요"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  내용
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="이메일 내용을 입력하세요"
                  rows={6}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                />
              </div>

              {/* PDF Attachment Option */}
              {pdfAvailable && onSendPdfEmail && (
                <label className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer hover:border-indigo-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={attachPdf}
                    onChange={(e) => setAttachPdf(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                  />
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">PDF 첨부</span>
                    {pdfFileName && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({pdfFileName})
                      </span>
                    )}
                  </div>
                </label>
              )}

              {/* Error */}
              {(localError || error) && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {localError || error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "compose" && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setView("list")}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                발송
              </button>
            </div>
          </div>
        )}

        {/* Footer for Contacts View */}
        {view === "contacts" && selectedContacts.size > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedContacts.size}개 연락처 선택됨
              </span>
              <button
                onClick={() => {
                  addSelectedContactsToField()
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4" />
                이메일 작성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
