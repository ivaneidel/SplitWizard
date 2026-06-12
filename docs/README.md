# SplitWizard — Project Docs

SplitWizard is a personal expense-splitting **PWA** (a Splitwise Pro clone) built with
Vite + React + TypeScript + Firebase. Its two reasons to exist are **auto-installments**
and **Excel import/export of full Splitwise history**; everything else is a curated
subset of Splitwise plus some quality-of-life extras.

Live at **https://splitwizard.web.app**.

These docs capture everything that was planned and built, batch by batch.

| Doc | Contents |
|-----|----------|
| [01 — Product & Decisions](01-product-and-decisions.md) | Feature set (kept/dropped), QoL extras, and the key product/tech decisions. |
| [02 — Architecture](02-architecture.md) | Stack, data model, pure engines, security rules, money/balances rules, emulator + tests. |
| [03 — Build Milestones](03-build-milestones.md) | The original 6-milestone build of the app. |
| [04 — Enhancement Batches](04-enhancements.md) | Every iteration after v1 (dark mode, group settings, editing, import fixes, guests & claiming, installment inference, polish). |
| [05 — Deploy & Ops](05-deploy-and-ops.md) | Firebase setup, hosting URLs, redeploy, emulator commands, env vars. |

See also the repo root [`README.md`](../README.md) for quick-start commands.
