"use client"

import Link from "next/link"
import { ArrowLeft, Download, CloudUpload, FolderOpen, LogOut, User, Loader2 } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface HeaderProps {
  showDownload?: boolean
  showCloudSave?: boolean
  showCloudFolder?: boolean
  onDownload?: () => void
  onCloudSave?: () => void
  onCloudFolder?: () => void
  onSignIn?: () => void
  onSignOut?: () => void
  user: SupabaseUser | null
  authLoading: boolean
  cloudUploading?: boolean
}

export function Header({
  showDownload = false,
  showCloudSave = false,
  showCloudFolder = false,
  onDownload,
  onCloudSave,
  onCloudFolder,
  onSignIn,
  onSignOut,
  user,
  authLoading,
  cloudUploading = false,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background flex-shrink-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left Side - Logo & Mode Toggle */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <img
                src="https://r2-images.dacon.co.kr/external/DAKER.svg"
                alt="DAKER"
                className="h-5 w-auto"
              />
              <span className="text-foreground/90">PDF Parser</span>
            </h1>
          </Link>
          <ModeToggle />
        </div>

        {/* Right Side - Actions & Auth */}
        <div className="flex items-center gap-3">
          {/* Download Button */}
          {showDownload && onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25"
            >
              <Download className="w-3.5 h-3.5" />
              다운로드
            </button>
          )}

          {/* Cloud Save Button */}
          {showCloudSave && onCloudSave && (
            <button
              onClick={onCloudSave}
              disabled={cloudUploading}
              title="클라우드에 저장"
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25"
            >
              {cloudUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              저장
            </button>
          )}

          {/* Cloud Folder Button */}
          {showCloudFolder && onCloudFolder && (
            <button
              onClick={onCloudFolder}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs rounded-lg transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              내 PDF
            </button>
          )}

          {/* Auth Section */}
          {authLoading ? (
            <div className="w-8 h-8 rounded-full bg-secondary animate-pulse ring-1 ring-border" />
          ) : user ? (
            <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-secondary/60 border border-border rounded-full hover:border-ring transition-all group">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="w-6 h-6 rounded-full ring-2 ring-indigo-500/40"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-2 ring-indigo-500/40">
                  <User className="w-3 h-3 text-white" />
                </div>
              )}
              <span className="text-xs text-secondary-foreground font-medium max-w-[80px] truncate hidden sm:inline px-1">
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </span>
              <button
                onClick={onSignOut}
                className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 px-4 py-1.5 bg-background hover:bg-secondary text-foreground text-xs font-semibold rounded-full shadow-sm hover:shadow-md border border-border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google 로그인
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
