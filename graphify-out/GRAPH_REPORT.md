# Graph Report - .  (2026-07-22)

## Corpus Check
- 65 files · ~106,425 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 707 nodes · 1193 edges · 49 communities (43 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Authentication UI
- Device Preferences Shell
- Account Edge Functions
- Responsive Admin Dialogs
- Development Dependencies
- Project Runtime Scripts
- Browser TypeScript Config
- Node TypeScript Config
- Calendar Month View
- Dark Desktop Navigation
- Foundation Desktop UI
- Preview Session E2E
- CoreGrid Architecture
- Foundation Database
- Personalization Architecture
- Settings Personalization UI
- Deployment Setup
- Foundation Mobile UI
- Account Capacity Design
- Calendar Design
- Secret Scanning
- Review Security Rationale
- Mobile Tab Navigation
- Theme Pages Bootstrap
- Light Desktop Navigation
- Authentication E2E
- Capacity Implementation
- Vite PWA Configuration
- CoreGrid Icon
- Query Client
- PWA Reload Prompt
- CI Quality Workflow
- E2E Server Setup
- TypeScript Project References
- Theme Bootstrap Tests

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `scripts` - 14 edges
3. `ResponsiveDialog()` - 13 edges
4. `useDevicePreferences()` - 13 edges
5. `compilerOptions` - 12 edges
6. `CoreGrid Design Specification` - 12 edges
7. `Expanded Sidebar Navigation` - 12 edges
8. `resolveRequestOrigin()` - 11 edges
9. `edgeConfiguration()` - 11 edges
10. `Sidebar navigation` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Device-Local Personalization` --semantically_similar_to--> `Versioned Device Preference Repository`  [INFERRED] [semantically similar]
  README.md → docs/superpowers/specs/2026-07-18-design-system-personalization-design.md
- `Required Supabase Build Secrets` --semantically_similar_to--> `Hosted Supabase Configuration`  [INFERRED] [semantically similar]
  .github/workflows/deploy-pages.yml → docs/setup-supabase.md
- `GitHub Pages Artifact Deployment` --semantically_similar_to--> `GitHub Pages Deployment Workflow`  [INFERRED] [semantically similar]
  .github/workflows/deploy-pages.yml → README.md
- `AdminAccountManagement()` --indirect_call--> `request()`  [INFERRED]
  src/features/settings/AdminAccountManagement.tsx → scripts/preview-session.test.ts
- `Final Personalization Review Fix Report` --conceptually_related_to--> `Responsive Personalization Verification`  [INFERRED]
  .superpowers/sdd/final-fix-report.md → docs/superpowers/plans/2026-07-18-design-system-personalization.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Foundation Security and Capacity Flow** — docs_superpowers_specs_2026_07_16_tyrone_control_center_design_ten_account_invitation_model, docs_superpowers_specs_2026_07_16_tyrone_control_center_design_rls_edge_security_model, docs_superpowers_plans_2026_07_16_foundation_implementation_transactional_account_capacity, docs_superpowers_plans_2026_07_16_foundation_implementation_secure_invitation_edge_functions, docs_superpowers_specs_2026_07_17_increase_account_capacity_database_owned_limit, docs_superpowers_specs_2026_07_17_increase_account_capacity_advisory_transaction_lock, docs_superpowers_specs_2026_07_17_increase_account_capacity_browser_capacity_advisory [INFERRED 0.95]
- **Device-Local Personalization Architecture** — docs_superpowers_specs_2026_07_18_design_system_personalization_device_preference_repository, docs_superpowers_specs_2026_07_18_design_system_personalization_navigation_catalog, docs_superpowers_specs_2026_07_18_design_system_personalization_responsive_navigation, docs_superpowers_specs_2026_07_18_design_system_personalization_responsive_dialog, docs_superpowers_specs_2026_07_18_design_system_personalization_toast_queue, docs_superpowers_specs_2026_07_18_design_system_personalization_role_aware_settings, docs_superpowers_plans_2026_07_18_design_system_personalization_typed_device_preference_architecture, index_applystoredtheme [EXTRACTED 1.00]
- **Calendar V1 Rendering Flow** — docs_superpowers_specs_2026_07_19_coregrid_calendar_v1_stable_42_day_model, docs_superpowers_specs_2026_07_19_coregrid_calendar_v1_semantic_month_table, docs_superpowers_specs_2026_07_19_coregrid_calendar_v1_responsive_month_view, docs_superpowers_plans_2026_07_19_coregrid_calendar_v1_deterministic_month_model, docs_superpowers_plans_2026_07_19_coregrid_calendar_v1_monthcalendar, docs_superpowers_plans_2026_07_19_coregrid_calendar_v1_calendarpage, docs_superpowers_plans_2026_07_19_coregrid_calendar_v1_calendar_verification [INFERRED 0.95]
- **Sidebar Destination Set** — docs_screenshots_design_dark_desktop_expanded_uebersicht_overview_page, docs_screenshots_design_dark_desktop_expanded_kalender, docs_screenshots_design_dark_desktop_expanded_aufgaben, docs_screenshots_design_dark_desktop_expanded_technikerarbeit, docs_screenshots_design_dark_desktop_expanded_schule, docs_screenshots_design_dark_desktop_expanded_training, docs_screenshots_design_dark_desktop_expanded_ernaehrung, docs_screenshots_design_dark_desktop_expanded_dateien, docs_screenshots_design_dark_desktop_expanded_ki_chat, docs_screenshots_design_dark_desktop_expanded_einstellungen [EXTRACTED 1.00]
- **Compact Desktop Navigation** — docs_screenshots_design_light_desktop_collapsed_desktop_layout, docs_screenshots_design_light_desktop_collapsed_collapsed_sidebar_navigation, docs_screenshots_design_light_desktop_collapsed_icon_only_navigation [INFERRED 0.85]
- **Primary Mobile Navigation** — docs_screenshots_design_mobile_tabs_overview_tab, docs_screenshots_design_mobile_tabs_calendar_tab, docs_screenshots_design_mobile_tabs_training_tab, docs_screenshots_design_mobile_tabs_files_tab, docs_screenshots_design_mobile_tabs_more_tab [EXTRACTED 1.00]
- **Device Personalization Controls** — docs_screenshots_design_settings_personalization_appearance_settings, docs_screenshots_design_settings_personalization_mobile_navigation, docs_screenshots_design_settings_personalization_session_management [EXTRACTED 1.00]
- **Account Administration** — docs_screenshots_design_settings_personalization_account_management, docs_screenshots_design_settings_personalization_member_invitation, docs_screenshots_design_settings_personalization_account_roster, docs_screenshots_design_settings_personalization_account_seat_limit [EXTRACTED 1.00]
- **Primary application navigation** — docs_screenshots_foundation_desktop_overview_navigation_item, docs_screenshots_foundation_desktop_calendar_navigation_item, docs_screenshots_foundation_desktop_tasks_navigation_item, docs_screenshots_foundation_desktop_technical_work_navigation_item, docs_screenshots_foundation_desktop_school_navigation_item, docs_screenshots_foundation_desktop_training_navigation_item, docs_screenshots_foundation_desktop_nutrition_navigation_item, docs_screenshots_foundation_desktop_files_navigation_item, docs_screenshots_foundation_desktop_ai_chat_navigation_item, docs_screenshots_foundation_desktop_settings_navigation_item [EXTRACTED 1.00]
- **Primary mobile navigation destinations** — docs_screenshots_foundation_mobile_overview_navigation_item, docs_screenshots_foundation_mobile_calendar_navigation_item, docs_screenshots_foundation_mobile_tasks_navigation_item, docs_screenshots_foundation_mobile_settings_navigation_item, docs_screenshots_foundation_mobile_more_navigation_item [EXTRACTED 1.00]

## Communities (49 total, 6 thin omitted)

### Community 0 - "Authentication UI"
Cohesion: 0.05
Nodes (59): getPublicEnv(), parsePublicEnv(), PublicEnv, schema, Button, ButtonProps, ButtonVariant, FormField() (+51 more)

### Community 1 - "Device Preferences Shell"
Cohesion: 0.06
Nodes (42): App(), AppProps, PreferenceBoundary(), PreferenceFailureTrigger(), mobileTabIndexes, PersonalSettings(), pinnableNavigationItems, SettingsPage() (+34 more)

### Community 2 - "Account Edge Functions"
Cohesion: 0.08
Nodes (43): BootstrapAdminDependencies, createBootstrapAdminHandler(), runtimeDependencies(), CleanupDependencies, createCleanupHandler(), response(), runtimeDependencies(), secretsMatch() (+35 more)

### Community 3 - "Responsive Admin Dialogs"
Cohesion: 0.06
Nodes (38): Card, ActiveSwipe, blockOutsideModalInteraction(), focusableSelector, focusDialogTarget(), focusTopModal(), getFocusableElements(), handleDocumentFocus() (+30 more)

### Community 4 - "Development Dependencies"
Cohesion: 0.05
Nodes (43): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jsdom, devDependencies, eslint (+35 more)

### Community 5 - "Project Runtime Scripts"
Cohesion: 0.05
Nodes (41): clsx, @hookform/resolvers, lucide-react, dependencies, clsx, @hookform/resolvers, lucide-react, react (+33 more)

### Community 6 - "Browser TypeScript Config"
Cohesion: 0.08
Nodes (25): DOM.Iterable, ES2022, src, @testing-library/jest-dom, vitest/globals, compilerOptions, allowJs, allowSyntheticDefaultImports (+17 more)

### Community 7 - "Node TypeScript Config"
Cohesion: 0.11
Nodes (18): ES2023, playwright.config.ts, tests/e2e/**/*.ts, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module (+10 more)

### Community 8 - "Calendar Month View"
Cohesion: 0.20
Nodes (13): buildMonthGrid(), CALENDAR_WEEKDAYS, CalendarDay, dateLabelFormatter, formatMonthLabel(), monthFormatter, sameCalendarDate(), shiftMonth() (+5 more)

### Community 9 - "Dark Desktop Navigation"
Cohesion: 0.12
Nodes (17): Aufgaben, Dark Desktop Expanded Layout, Dateien, Einstellungen, Ernährung, Expanded Sidebar Navigation, Grundlage Section, Kalender (+9 more)

### Community 10 - "Foundation Desktop UI"
Cohesion: 0.12
Nodes (17): KI-Chat navigation item, Kalender navigation item, Desktop dashboard layout, Dateien navigation item, Grundlage section, Module activation in a later milestone, Ernährung navigation item, Übersicht navigation item (+9 more)

### Community 11 - "Preview Session E2E"
Cohesion: 0.17
Nodes (9): adminProfile, memberProfile, request(), expectControlInsideSidebar(), expectFocusedControlOutlineInsideSidebar(), createProfile(), fulfillJson(), installPreviewSession() (+1 more)

### Community 12 - "CoreGrid Architecture"
Cohesion: 0.16
Nodes (14): Installable Offline PWA Shell, CoreGrid Foundation Implementation Plan, Invitation-Based Authentication and Protected Routing, Secure Bootstrap and Invitation Edge Functions, Static React and Supabase Architecture, Calendar and Task Domain, CoreGrid, Immutable File Versioning (+6 more)

### Community 13 - "Foundation Database"
Cohesion: 0.18
Nodes (5): public.activity_log, public.deactivate_profile(), public.function_rate_limits, public.invitations, public.profiles

### Community 14 - "Personalization Architecture"
Cohesion: 0.23
Nodes (13): Document-Level Modal Stack Focus Containment, Central Navigation Catalog, Design System Personalization Implementation Plan, Responsive Dialog and Toast Primitives, Role-Aware Settings Composition, AI Provider Adapter System, No Silent AI Writes, Design System Personalization Design Specification (+5 more)

### Community 15 - "Settings Personalization UI"
Cohesion: 0.18
Nodes (13): Account Management, Account Roster, Ten-Seat Account Limit, Appearance Settings, Collapsible Desktop Sidebar, Dark Mode, Desktop Sidebar Navigation, Device Logout Controls (+5 more)

### Community 16 - "Deployment Setup"
Cohesion: 0.20
Nodes (11): Deploy GitHub Pages Workflow, GitHub Pages Artifact Deployment, Required Supabase Build Secrets, Bootstrap Administrator Flow, Database-First Capacity Upgrade, Account Edge Function Deployment, Hosted Supabase Configuration, Local Supabase Environment (+3 more)

### Community 17 - "Foundation Mobile UI"
Cohesion: 0.22
Nodes (11): Bottom navigation, Kalender navigation item, Mobile foundation overview screen, Grundlage section, Future milestone activation, Mehr navigation item, Übersicht navigation item, Übersicht page (+3 more)

### Community 18 - "Account Capacity Design"
Cohesion: 0.29
Nodes (10): Transactional Account Capacity Enforcement, Ten-Account Invitation Model, Advisory Transaction Lock for Admission, Browser Capacity State Is Advisory, get_account_capacity RPC, Database-Owned Account Capacity Limit, Ten-Account Capacity Design, CoreGrid README (+2 more)

### Community 19 - "Calendar Design"
Cohesion: 0.36
Nodes (10): Calendar Unit, Route, and Browser Verification, CalendarPage, Deterministic Monday-First Month Model, MonthCalendar, CoreGrid Calendar V1 Implementation Plan, CoreGrid Calendar V1 Design Specification, No External Calendar Data Constraint, Responsive German Month View (+2 more)

### Community 20 - "Secret Scanning"
Cohesion: 0.38
Nodes (8): detectSecrets(), filesUnder(), formatFinding(), isPlaceholder(), main(), scanRepository(), trackedFiles(), valueDetectors

### Community 21 - "Review Security Rationale"
Cohesion: 0.25
Nodes (9): Dedicated Focus Ring Token, Guarded Browser Storage Boundary, On-Primary Contrast Mapping, Final Personalization Review Fix Report, Responsive Personalization Verification, Versioned Offline Conflict Handling, Navy Slate Visual System, Dark and Light Semantic Theme Tokens (+1 more)

### Community 22 - "Mobile Tab Navigation"
Cohesion: 0.25
Nodes (9): Bottom Tab Navigation, Calendar Tab, Files Tab, Future Milestone Module, Milestone-Based Feature Gating, Mobile Overview Screen, More Tab, Overview Tab (+1 more)

### Community 23 - "Theme Pages Bootstrap"
Cohesion: 0.25
Nodes (8): Typed Device Preference Repository and Provider, Versioned Device Preference Repository, applyStoredTheme, CoreGrid HTML Entry Point, restoreGitHubPagesRoute, GitHub Pages 404 Fallback, SPA Fallback Redirect Protocol, Device-Local Personalization

### Community 24 - "Light Desktop Navigation"
Cohesion: 0.29
Nodes (7): Collapsed Sidebar Navigation, Desktop Layout, Icon-Only Navigation, Light Visual Theme, Overview Page, Prepared Area Notice, Übersicht Light Desktop Collapsed Screen

### Community 25 - "Authentication E2E"
Cohesion: 0.38
Nodes (4): invitationLink(), invokeFunction(), requiredEnv(), setInvitedPassword()

### Community 26 - "Capacity Implementation"
Cohesion: 0.33
Nodes (6): Ten-Account Capacity Implementation Plan, Concurrent Ten-to-Eleven Account Boundary, Database Capacity API, Draft Pull Request Delivery, Frontend Capacity State, Number-Neutral Capacity Error

### Community 29 - "CoreGrid Icon"
Cohesion: 0.67
Nodes (4): CoreGrid, CoreGrid Icon, Rounded Square App Badge, TC Monogram

### Community 32 - "CI Quality Workflow"
Cohesion: 0.67
Nodes (3): CI Workflow, Quality Pipeline, Repository and Build Secret Scanning

## Knowledge Gaps
- **201 isolated node(s):** `name`, `private`, `version`, `type`, `node` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AdminAccountManagement()` connect `Responsive Admin Dialogs` to `Device Preferences Shell`, `Preview Session E2E`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `request()` connect `Preview Session E2E` to `Responsive Admin Dialogs`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Development Dependencies` to `Project Runtime Scripts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Authentication UI` be split into smaller, more focused modules?**
  _Cohesion score 0.050061050061050064 - nodes in this community are weakly interconnected._
- **Should `Device Preferences Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.06004543979227524 - nodes in this community are weakly interconnected._
- **Should `Account Edge Functions` be split into smaller, more focused modules?**
  _Cohesion score 0.08450704225352113 - nodes in this community are weakly interconnected._