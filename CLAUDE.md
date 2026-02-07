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

- **app/** - Next.js App Router 페이지 및 레이아웃
- **components/main/** - 메인 랜딩 페이지 컴포넌트 (Hero 등)
- 경로 alias: `@/*` → 프로젝트 루트

### Key Component: Hero (components/main/Hero.tsx)

Canvas 기반 파티클 텍스트 애니메이션이 배경으로 동작하는 히어로 섹션. Particle 클래스가 물리 기반 이동/색상 블렌딩을 처리하며, `requestAnimationFrame` 루프로 구동. "PDF", "Parser", "DAKER", "AI" 텍스트를 순환 표시.

## Stack & Conventions

- **React 19** with `"use client"` directive for client components
- **Tailwind CSS v4** via PostCSS (`@import "tailwindcss"` in globals.css)
- **Pretendard Variable** 폰트 (CDN, 한국어 지원)
- **한국어(ko)** 기본 언어 설정
- `useRef`에 초기값 필수 (React 19): `useRef<number>(undefined)` not `useRef<number>()`
- ESLint: `eslint-config-next/core-web-vitals` + `typescript`
