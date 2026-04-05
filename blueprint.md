# Blueprint for Taegomap Education Sector Pricing System

## Project Overview
The Taegomap application aims to provide a comprehensive map service for users in Gwangju-Hanam, focusing on local amenities. This blueprint outlines the implementation of a new feature: the Education Sector Pricing System, which integrates local education office regulations for teaching fees.

## Existing Features
*   Basic web application structure (HTML, CSS, JavaScript).
*   Firebase Hosting integration.
*   Basic map functionality (implied by "Taegomap").
*   Content display on `index.html`.

## New Feature: Education Sector Pricing System

### Goal
Implement a robust and accurate system within Taegomap to automatically calculate legal teaching fees based on Gyeonggi-do Gwangju-Hanam Education Support Office's regulations, compare them with actual reported fees, and flag potential violations. This includes displaying relevant pricing information and enabling filtering based on these criteria.

### Key Components

#### 1. Firestore `officialRates` Collection
*   **Purpose:** Store the official teaching fee adjustment standards as per the Gyeonggi-do Gwangju-Hanam Education Support Office. This will be a read-only collection for general users, managed by administrators.
*   **Schema:**
    *   `id` (string): Criteria key (e.g., "보습_초등").
    *   `domain` (string): Field (e.g., "보습", "외국어", "음악").
    *   `series` (string): Category (e.g., "보통교과", "예능").
    *   `course` (string): Teaching course (e.g., "단과", "어학", "음악").
    *   `grade` (string): Classification (e.g., "초등", "중등", "고등", "입시", "전체").
    *   `ratePerMin` (number): Rate per minute (원/분).
    *   `monthlyWeeks` (number): Monthly teaching weeks (fixed at 4.3).
    *   `effectiveDate` (string): Effective date (e.g., "2025-02-01").
    *   `isFlat` (boolean): Flat rate type (for reading rooms).
    *   `flatDay` (number): Daily flat rate (for reading rooms only).
    *   `flatMonth` (number): Monthly flat rate (for reading rooms only).
    *   `source` (string): Source URL (e.g., "goeyi.kr 교습비 조정기준").
    *   `updatedAt` (timestamp): Last updated timestamp.
*   **Seeding:** Initial data will be populated into this collection via a dedicated JavaScript function (`seedOfficialRates`), executed once.

#### 2. Firestore `places` Collection Updates (Education Fields)
*   **Purpose:** Extend existing `places` documents (for `category: academy | study | reading_room`) to include education-specific pricing and legal compliance fields.
*   **Schema Additions:**
    *   `registrationNo` (string): Academy registration number (mandatory).
    *   `rateKey` (string): Key from `officialRates` collection (e.g., "보습_중등").
    *   `officialFee` (number): Calculated legal maximum teaching fee (원/월).
    *   `officialFeeParams.min` (number): Teaching time per session (minutes) for legal fee calculation.
    *   `officialFeeParams.sessions` (number): Sessions per week for legal fee calculation.
    *   `actualFee.tuition` (number): Actual reported tuition fee (원/월).
    *   `actualFee.textbook` (number): Textbook cost (원/월).
    *   `actualFee.shuttle` (number): Shuttle cost (원/월).
    *   `actualFee.mockExam` (number): Mock exam cost (원/월).
    *   `actualFee.material` (number): Material cost (원/월).
    *   `actualFee.meal` (number): Meal cost (원/월).
    *   `actualFee.other` (number): Other expenses (원/월).
    *   `excessFlag` (boolean): Flag for exceeding legal teaching fee by 5% (auto-calculated).
    *   `excessPct` (number): Excess percentage (negative if below).
    *   `verified` (boolean): Receipt verification status (from Firebase Storage).

#### 3. JavaScript Logic (Client-side)
*   **`getOfficialRate(rateKey)`:** Function to asynchronously fetch and cache official rate data from Firestore.
*   **`calcLegalFee(ratePerMin, minutesPerSession, sessionsPerWeek, weeks=4.3)`:** Calculates the legal maximum monthly teaching fee.
*   **`judgeExcess(officialFee, actualTuition)`:** Determines if the actual tuition exceeds the legal fee, including a 5% warning threshold.
*   **`calcTotalActual(fees={})`:** Calculates the total actual payment including tuition and other expenses.
*   **`renderEduPriceSection(placeData, container)`:** Renders a detailed education pricing section for a given place, displaying legal fees, actual fees, excess judgment, and extra costs.
*   **`seedOfficialRates()`:** One-time function to populate the `officialRates` collection in Firestore.

#### 4. UI Integration
*   **Display:** Integrate `renderEduPriceSection` into the map's info window or a dedicated detail panel for educational institutions.
*   **Warnings:** Visually highlight `excessFlag` and `excessPct` with warning badges.
*   **Map Marker Filters:** Implement filtering options on the map based on `officialFee` ranges and `excessFlag` status, changing marker colors accordingly. (This will be a subsequent task after core logic is implemented.)

## Plan for Current Request

### Phase 1: Firestore Data & Core Logic Implementation

1.  **Define Firestore `officialRates` Collection Schema:**
    *   Document the precise structure and data types for the `officialRates` collection based on the provided "3-1. officialRates 컬렉션 — 교육청 공식 조정기준 DB" section.
    *   Ensure all fields, including `isFlat`, `flatDay`, `flatMonth`, `source`, and `updatedAt`, are correctly represented.

2.  **Implement `seedOfficialRates` Function:**
    *   Create a new JavaScript file (e.g., `firestore-seed.js`) to house the `seedOfficialRates` function.
    *   Copy the `RATES_2025` array and the `seedOfficialRates` function body from the provided "5-2. officialRates 초기 데이터 Firestore 입력 코드" section.
    *   Ensure Firebase Firestore SDK (`window.FS`, `window.db`) is properly initialized and accessible before this function runs. This will likely require updating `main.js` or `index.html` to include the Firebase SDK and initialize `db`.
    *   Provide instructions on how to execute this function once (e.g., calling it from the browser console, or temporarily adding it to `main.js`).

3.  **Implement Core Pricing Calculation Modules:**
    *   Create a new JavaScript file (e.g., `pricing-utils.js`) for the core pricing logic.
    *   Implement `getOfficialRate(rateKey)`, `calcLegalFee()`, `judgeExcess()`, and `calcTotalActual()` functions as described in "5-1. officialRates 조회 및 법정 교습비 계산 모듈".
    *   Ensure these functions are exported for use in other parts of the application.

### Phase 2: UI Integration & `places` Collection Update

4.  **Update `places` Collection Fields:**
    *   Acknowledge the need to add new fields to `places` documents for educational categories. This is a schema update for Firestore documents, which doesn't directly involve client-side code modification at this stage, but needs to be documented for backend/data management.
    *   (Note: Actual population of these fields for existing places would be a separate data migration task.)

5.  **Implement `renderEduPriceSection`:**
    *   Add this function to `pricing-utils.js` or a new UI-specific module.
    *   It will take `placeData` and a `container` element, then dynamically generate the HTML structure for the education pricing display.
    *   This function will utilize the `getOfficialRate`, `calcLegalFee`, `judgeExcess`, and `calcTotalActual` functions.

6.  **Integrate into Main Application:**
    *   Modify `main.js` to initialize Firebase Firestore (`window.db`).
    *   Import `pricing-utils.js` and potentially `firestore-seed.js`.
    *   Set up a mechanism to call `renderEduPriceSection` when a specific place's details are viewed (e.g., when a map marker is clicked and its info window opens). This will involve identifying where `placeData` becomes available in the existing map logic.
    *   Add necessary CSS from the `renderEduPriceSection` example to `style.css` for proper styling.

7.  **Map Marker Filters (Future Task):**
    *   This is explicitly marked as a future task, after the core pricing display is functional. It involves adding UI controls for filtering and modifying map marker rendering logic.

### Verification
*   **Firestore Data:** Verify that the `officialRates` collection is correctly populated after running `seedOfficialRates`.
*   **Local Calculation:** Test `calcLegalFee`, `judgeExcess`, `calcTotalActual` with sample data.
*   **UI Display:** Ensure `renderEduPriceSection` correctly displays all relevant information and warnings in the application's UI.

----
