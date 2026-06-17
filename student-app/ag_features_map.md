# AG Features Map (功能与文件结构映射表)

This document maps application features to their specific codebase directories and source files to enable token-efficient context loading.

---

## 1. Italian Train Info Query Tool (意铁看板与车次追踪)
- **Service Layer (API, Operators, Platform mappings):**
  - [viaggiaTrenoService.ts](file:///i:/PARTTIME/AG/student-app/lib/viaggiaTrenoService.ts)
- **UI Views & State (React Native / Expo Router):**
  - [index.tsx (Search Landing & Favorites Lists)](file:///i:/PARTTIME/AG/student-app/app/tools/train/index.tsx)
  - [station-board.tsx (Real-time Departures/Arrivals Board)](file:///i:/PARTTIME/AG/student-app/app/tools/train/station-board.tsx)
  - [train-status.tsx (Real-time Vertical Route Timeline Tracker)](file:///i:/PARTTIME/AG/student-app/app/tools/train/train-status.tsx)
- **Data Assets (Fuzzy Station Index):**
  - [stations.ts](file:///i:/PARTTIME/AG/student-app/assets/stations.ts)

---

## 2. Classroom Query Tool (教室查询/空闲教室筛选)
- **Feature Directory:** `i:/PARTTIME/AG/student-app/app/tools/classroom`
- **Main Components:**
  - View classrooms, buildings, capacities, and filtering by campuses.

---

## 3. Dictionary Search Tool (多词库离线查询)
- **Feature Directory:** `i:/PARTTIME/AG/student-app/app/tools/dictionary`
- **Dictionary Parser / MDict engine:**
  - MDict readers and database files.

---

## 4. Student Handbook Tool (学生手册检索)
- **Feature Directory:** `i:/PARTTIME/AG/student-app/app/tools/handbook`
- **Handbook Database & Indexing:**
  - Queries local SQL databases or documents for handbook content.

---

## 5. Exchange Rate Tool (汇率查询)
- **UI Screen:**
  - [rate.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/rate.tsx)

---

## 6. Shared Themes & Styling
- **Theme & Translations Context:**
  - [ThemeContext.tsx](file:///i:/PARTTIME/AG/student-app/context/ThemeContext.tsx)
