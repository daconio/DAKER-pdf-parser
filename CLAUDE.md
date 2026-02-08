# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DAKER PDF Parser - AI 기반 PDF 문서 변환 웹 애플리케이션의 랜딩 페이지. Next.js 16 (App Router) + TypeScript + Tailwind CSS v4.

## Commands

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드 (Turbopack)
npm run start    # 프로덕션 서버 실행
npm run lint     # ESLint 실행
```

## Architecture

### Directory Structure

```
├── app/                    # Next.js App Router
│   ├── convert/[mode]/     # PDF 변환/편집 메인 페이지
│   ├── api/                # API Routes (edit-pdf, pdf-storage)
│   └── auth/               # OAuth 콜백
├── components/
│   ├── ai/                 # AI 관련 (PromptTemplates)
│   ├── convert/            # 변환 관련 (ModeSelector)
│   ├── editor/             # 편집 도구 (DirectToolbar, PageNavigator, ColorPicker)
│   ├── layout/             # 레이아웃 (Header)
│   ├── main/               # 랜딩 페이지 (Hero)
│   ├── ui/                 # 공통 UI (ProgressBar, RecoveryDialog, CloudPanel)
│   └── upload/             # 파일 업로드 (FileUploader)
├── hooks/                  # Custom React Hooks
│   ├── useAuth.ts          # 인증 상태 관리
│   ├── useCloudStorage.ts  # 클라우드 스토리지
│   └── useUndoHistory.ts   # Undo/Redo 히스토리
├── lib/
│   ├── pdfService.ts       # PDF 변환 유틸리티
│   ├── pdfLoader.ts        # 동적 PDF 라이브러리 로더
│   ├── supabase.ts         # Supabase 클라이언트
│   ├── idb.ts              # IndexedDB 세션 복구
│   └── types.ts            # TypeScript 타입 정의
```

- 경로 alias: `@/*` → 프로젝트 루트

### Key Components

**Hero (components/main/Hero.tsx)**
Canvas 기반 파티클 텍스트 애니메이션이 배경으로 동작하는 히어로 섹션. Particle 클래스가 물리 기반 이동/색상 블렌딩을 처리하며, `requestAnimationFrame` 루프로 구동. "PDF", "Parser", "DAKER", "AI" 텍스트를 순환 표시.

**AI Editor Features**
- AI 모드: Gemini 3 Pro Vision API로 자연어 편집
- Direct 모드: 그리기, 텍스트, 사각형, 지우개 도구
- 20단계 Undo/Redo 히스토리 (페이지별)
- 프롬프트 템플릿 (오타 수정, 번역, 색상 변경 등)

### Custom Hooks Usage

```typescript
import { useAuth, useCloudStorage, useUndoHistory } from "@/hooks"

const { user, signInWithGoogle, signOut } = useAuth()
const { files, uploadFile, downloadFile } = useCloudStorage({ user, getAccessToken })
const { push, pop, canUndo } = useUndoHistory()
```

## Stack & Conventions

- **React 19** with `"use client"` directive for client components
- **Tailwind CSS v4** via PostCSS (`@import "tailwindcss"` in globals.css)
- **Pretendard Variable** 폰트 (CDN, 한국어 지원)
- **한국어(ko)** 기본 언어 설정
- `useRef`에 초기값 필수 (React 19): `useRef<number>(undefined)` not `useRef<number>()`
- ESLint: `eslint-config-next/core-web-vitals` + `typescript`
- **Branding**: DAKER logo uses SVG asset: `https://r2-images.dacon.co.kr/external/DAKER.svg`

## Documentation Rules

- **ARD (Architecture Decision Record)**: You MUST update `ARD.md` after every completed task or major change. Log specific architectural decisions, significant bug fixes (like layout shifts), or new feature implementations.

