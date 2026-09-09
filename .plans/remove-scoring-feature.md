# Plan: Remove Scoring/Rating Functionality

## Overview
Remove the AI-powered scoring/rating system that evaluates weekly reports on structure, content, and value dimensions.

## Affected Areas

### 1. Core Scoring Logic
- **File**: `src/lib/scoring.ts`
  - Delete entire file (triggerAsyncScoring, triggerAsyncVariantScoring, broadcast system)
- **File**: `src/lib/ai.ts`
  - Remove `scoreReport()` function
  - Remove ScoreRequest, ScoreResponse types

### 2. Database Schema
- **File**: `src/lib/db/schema.ts`
  - Remove score fields from `reports` table:
    - scoreStatus, scoreStructure, scoreContent, scoreValue, scoreOverall
    - suggestions, scoreError, scoredAt
  - Remove score fields from `reportVariants` table (same fields)
  - Remove score weight fields from `aiStyles` table:
    - scoreStructureWeight, scoreContentWeight, scoreValueWeight
  - Remove 'score' from SystemPromptKey type

### 3. UI Components
- **File**: `src/components/ScoreCard.tsx`
  - Delete entire component
- **File**: `src/components/ReportWorkspace.tsx`
  - Remove ScoreCard import and usage
- **File**: `src/components/ReportList.tsx`
  - Remove EventSource('/api/reports/score-stream') subscription
  - Remove handleRescore function
  - Remove rescore button/UI

### 4. API Routes
- **Directory**: `src/app/api/reports/score-stream/`
  - Delete directory and route.ts
- **Directory**: `src/app/api/reports/[id]/rescore/`
  - Delete directory and route.ts
- **Directory**: `src/app/api/reports/[id]/score-internal/`
  - Delete directory and route.ts
- **Directory**: `src/app/api/reports/check/`
  - Delete directory and route.ts (or remove scoreReport delegation if it has other purposes)

### 5. Generation Service
- **File**: `src/lib/generation/service.ts`
  - Remove triggerAsyncVariantScoring import
  - Remove triggerAsyncVariantScoring call after accepting proposal (line ~662)
- **File**: `src/app/api/reports/[id]/final/route.ts`
  - Remove triggerAsyncScoring and triggerAsyncVariantScoring imports and calls

### 6. AI Styles Configuration
- **File**: `src/lib/ai/styles.ts`
  - Remove scoreWeights property from all style definitions
- **File**: `src/lib/ai/style-helpers.ts`
  - Remove any score weight handling code (if exists)

### 7. Database Migrations
- **File**: `src/lib/db/migrations.ts`
  - Add migration to drop score-related columns from reports, reportVariants, and aiStyles tables

### 8. Tests
- Remove or update tests that reference scoring:
  - `src/lib/generation/service.test.ts`
  - `src/lib/validations.test.ts`
  - `e2e/final-generation.spec.ts`
  - `e2e/proposal-review.spec.ts`
  - `e2e/structure-completeness.spec.ts`
  - `e2e/legacy-migration.spec.ts`
  - `e2e/report-list-tool.spec.ts`

### 9. Type Definitions
- **File**: `src/lib/db/schema.ts`
  - Remove ScoreStatus type export

## Implementation Order

1. Remove UI layer (ScoreCard, ReportWorkspace, ReportList)
2. Remove API routes (score-stream, rescore, score-internal, check)
3. Remove service layer calls (generation/service.ts, final/route.ts)
4. Remove core logic (scoring.ts, ai.ts scoreReport function)
5. Update AI styles (remove scoreWeights)
6. Update database schema and create migration
7. Update/remove affected tests
8. Verify no remaining references

## Verification Steps

After implementation:
1. Search for "score" in codebase to find any remaining references
2. Search for "rating" and "评分" in codebase
3. Run TypeScript type checking: `npm run type-check` (or equivalent)
4. Run unit tests: `npm test`
5. Run e2e tests: `npm run test:e2e`
6. Build the application: `npm run build`
7. Test creating and viewing a report without scoring UI/functionality
