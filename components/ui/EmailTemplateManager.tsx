"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Copy,
  Scissors,
  Clipboard,
  Star,
  StarOff,
  GripVertical,
  Undo,
  Redo,
  FileText,
  ChevronDown,
  Loader2,
} from "lucide-react"
import type { EmailTemplate, AddTemplateParams } from "@/hooks/useEmailTemplates"

interface EmailTemplateManagerProps {
  templates: EmailTemplate[]
  loading: boolean
  error: string | null
  clipboard: EmailTemplate | null
  canUndo: boolean
  canRedo: boolean
  onFetchTemplates: (type?: EmailTemplate["type"]) => Promise<void>
  onAddTemplate: (template: AddTemplateParams) => Promise<boolean>
  onUpdateTemplate: (id: string, updates: Partial<Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">>) => Promise<boolean>
  onDeleteTemplates: (ids: string[]) => Promise<boolean>
  onReorderTemplates: (updates: Array<{ id: string; sort_order: number }>) => Promise<boolean>
  onSetDefaultTemplate: (id: string) => Promise<boolean>
  onDuplicateTemplate: (id: string) => Promise<boolean>
  onUndo: () => Promise<void>
  onRedo: () => Promise<void>
  onCopyTemplate: (id: string) => void
  onCutTemplate: (id: string) => Promise<boolean>
  onPasteTemplate: () => Promise<boolean>
  onSelectTemplate?: (template: EmailTemplate) => void
  mode?: "manage" | "select"
}

type TemplateType = EmailTemplate["type"]

export function EmailTemplateManager({
  templates,
  loading,
  error,
  clipboard,
  canUndo,
  canRedo,
  onFetchTemplates,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplates,
  onReorderTemplates,
  onSetDefaultTemplate,
  onDuplicateTemplate,
  onUndo,
  onRedo,
  onCopyTemplate,
  onCutTemplate,
  onPasteTemplate,
  onSelectTemplate,
  mode = "manage",
}: EmailTemplateManagerProps) {
  const [activeTab, setActiveTab] = useState<TemplateType>("header")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTemplate, setNewTemplate] = useState<AddTemplateParams>({
    name: "",
    type: "header",
    content: "",
    is_default: false,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<{ name: string; content: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [localError, setLocalError] = useState<string | null>(null)

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to cancel editing
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null)
          setEditingData(null)
        }
        if (showAddForm) {
          setShowAddForm(false)
        }
      }

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) onUndo()
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) onRedo()
      }

      // Ctrl/Cmd + C for copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedIds.size === 1) {
        e.preventDefault()
        onCopyTemplate(Array.from(selectedIds)[0])
      }

      // Ctrl/Cmd + X for cut
      if ((e.ctrlKey || e.metaKey) && e.key === "x" && selectedIds.size === 1) {
        e.preventDefault()
        onCutTemplate(Array.from(selectedIds)[0])
      }

      // Ctrl/Cmd + V for paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboard) {
        e.preventDefault()
        onPasteTemplate()
      }

      // Delete key
      if (e.key === "Delete" && selectedIds.size > 0) {
        e.preventDefault()
        onDeleteTemplates(Array.from(selectedIds))
        setSelectedIds(new Set())
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [editingId, showAddForm, canUndo, canRedo, selectedIds, clipboard, onUndo, onRedo, onCopyTemplate, onCutTemplate, onPasteTemplate, onDeleteTemplates])

  // Fetch templates on mount and tab change
  useEffect(() => {
    onFetchTemplates(activeTab)
  }, [activeTab, onFetchTemplates])

  // Filter templates by active tab
  const filteredTemplates = templates.filter(t => t.type === activeTab)

  const handleAddTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      setLocalError("이름과 내용을 모두 입력해주세요.")
      return
    }

    const success = await onAddTemplate({
      ...newTemplate,
      type: activeTab,
    })

    if (success) {
      setShowAddForm(false)
      setNewTemplate({ name: "", type: "header", content: "", is_default: false })
      setLocalError(null)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingId || !editingData) return

    if (!editingData.name.trim() || !editingData.content.trim()) {
      setLocalError("이름과 내용을 모두 입력해주세요.")
      return
    }

    const success = await onUpdateTemplate(editingId, {
      name: editingData.name,
      content: editingData.content,
    })

    if (success) {
      setEditingId(null)
      setEditingData(null)
      setLocalError(null)
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) {
      setDragOverId(id)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const draggedIndex = filteredTemplates.findIndex(t => t.id === draggedId)
    const targetIndex = filteredTemplates.findIndex(t => t.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Calculate new sort orders
    const updates = filteredTemplates.map((t, i) => {
      if (i === draggedIndex) {
        return { id: t.id, sort_order: targetIndex }
      }
      if (draggedIndex < targetIndex) {
        // Moving down
        if (i > draggedIndex && i <= targetIndex) {
          return { id: t.id, sort_order: i - 1 }
        }
      } else {
        // Moving up
        if (i >= targetIndex && i < draggedIndex) {
          return { id: t.id, sort_order: i + 1 }
        }
      }
      return { id: t.id, sort_order: i }
    })

    await onReorderTemplates(updates)
    setDraggedId(null)
    setDragOverId(null)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const tabLabels: Record<TemplateType, string> = {
    header: "헤더",
    footer: "푸터",
    signature: "서명",
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
        {(["header", "footer", "signature"] as TemplateType[]).map(type => (
          <button
            key={type}
            onClick={() => {
              setActiveTab(type)
              setSelectedIds(new Set())
              setEditingId(null)
              setShowAddForm(false)
            }}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === type
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabLabels[type]}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
          {clipboard && (
            <button
              onClick={onPasteTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors"
              title="붙여넣기 (Ctrl+V)"
            >
              <Clipboard className="w-4 h-4" />
              붙여넣기
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 hover:bg-secondary rounded transition-colors disabled:opacity-30"
            title="실행 취소 (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 hover:bg-secondary rounded transition-colors disabled:opacity-30"
            title="다시 실행 (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Actions */}
      {selectedIds.size > 0 && mode === "manage" && (
        <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
          <span className="text-sm text-muted-foreground">{selectedIds.size}개 선택</span>
          {selectedIds.size === 1 && (
            <>
              <button
                onClick={() => onCopyTemplate(Array.from(selectedIds)[0])}
                className="p-1.5 hover:bg-secondary rounded transition-colors"
                title="복사 (Ctrl+C)"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => onCutTemplate(Array.from(selectedIds)[0])}
                className="p-1.5 hover:bg-secondary rounded transition-colors"
                title="잘라내기 (Ctrl+X)"
              >
                <Scissors className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDuplicateTemplate(Array.from(selectedIds)[0])}
                className="p-1.5 hover:bg-secondary rounded transition-colors"
                title="복제"
              >
                <FileText className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => {
              onDeleteTemplates(Array.from(selectedIds))
              setSelectedIds(new Set())
            }}
            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"
            title="삭제 (Delete)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
          <h4 className="text-sm font-medium">새 {tabLabels[activeTab]} 추가</h4>
          <input
            type="text"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            placeholder="템플릿 이름"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <textarea
            value={newTemplate.content}
            onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
            placeholder="템플릿 내용 (HTML 지원)"
            rows={4}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none font-mono"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newTemplate.is_default}
              onChange={(e) => setNewTemplate({ ...newTemplate, is_default: e.target.checked })}
              className="rounded border-border"
            />
            기본 템플릿으로 설정
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false)
                setLocalError(null)
              }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleAddTemplate}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">저장된 {tabLabels[activeTab]}가 없습니다</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 text-indigo-500 hover:text-indigo-400 text-sm font-medium"
          >
            첫 템플릿 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              draggable={mode === "manage" && editingId !== template.id}
              onDragStart={(e) => handleDragStart(e, template.id)}
              onDragOver={(e) => handleDragOver(e, template.id)}
              onDrop={(e) => handleDrop(e, template.id)}
              onDragEnd={() => {
                setDraggedId(null)
                setDragOverId(null)
              }}
              onClick={() => {
                if (mode === "select" && onSelectTemplate) {
                  onSelectTemplate(template)
                } else if (mode === "manage" && editingId !== template.id) {
                  toggleSelect(template.id)
                }
              }}
              className={`group p-3 rounded-xl transition-all cursor-pointer ${
                dragOverId === template.id
                  ? "border-2 border-indigo-500 bg-indigo-500/10"
                  : draggedId === template.id
                    ? "opacity-50"
                    : selectedIds.has(template.id)
                      ? "bg-indigo-500/10 border border-indigo-500/30"
                      : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
              }`}
            >
              {editingId === template.id && editingData ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingData.name}
                    onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                    autoFocus
                  />
                  <textarea
                    value={editingData.content}
                    onChange={(e) => setEditingData({ ...editingData, content: e.target.value })}
                    rows={3}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm font-mono resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setEditingData(null)
                      }}
                      className="p-1.5 hover:bg-secondary rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleUpdateTemplate}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  {mode === "manage" && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(template.id)
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-border"
                        }`}
                      >
                        {selectedIds.has(template.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{template.name}</span>
                      {template.is_default && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
                      {template.content}
                    </p>
                  </div>
                  {mode === "manage" && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetDefaultTemplate(template.id)
                        }}
                        className="p-1.5 hover:bg-secondary rounded transition-colors"
                        title={template.is_default ? "기본 해제" : "기본으로 설정"}
                      >
                        {template.is_default ? (
                          <StarOff className="w-4 h-4" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(template.id)
                          setEditingData({
                            name: template.name,
                            content: template.content,
                          })
                        }}
                        className="p-1.5 hover:bg-secondary rounded transition-colors"
                        title="편집"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteTemplates([template.id])
                        }}
                        className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {(localError || error) && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {localError || error}
        </div>
      )}
    </div>
  )
}
