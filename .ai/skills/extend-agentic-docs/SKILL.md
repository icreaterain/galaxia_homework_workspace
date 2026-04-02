# Extending Agentic Documentation

Extends and maintains the agentic workspace documentation (`WORKSPACE.md`, `ARCHITECTURE.md`, `.ai/rules/`, `.ai/skills/`) as the implementation evolves. Use when an architectural decision is made, conventions change, a new feature area is added, or you need to document a new pattern for future sessions.

This project treats documentation as a first-class engineering artifact. Every significant decision,
pattern, or convention must be captured so future agents (and engineers) can reason about the system
without archaeology.

## When to Trigger This Skill

- A new architectural decision is made (ORM choice, auth strategy change, new service, etc.)
- A new feature domain is added beyond the initial scope (e.g., product images, notifications)
- A convention is established through implementation (folder structure, naming, patterns)
- A new external dependency is added
- Environment variables, ports, or the Docker Compose setup changes
- A new rule or skill is needed for a recurring pattern

## What to Update and Where

| Change type | Where to update |
|---|---|
| Architectural decision | New file in `adr/` + update `adr/README.md` index + update `ARCHITECTURE.md` if the current state changes |
| Convention or operating rule | `WORKSPACE.md` + relevant `.ai/rules/*.md` |
| New feature domain | `WORKSPACE.md` (functional areas section) + new skill if warranted |
| New env var or port | `WORKSPACE.md` (env config section) + `.env.example` + `ARCHITECTURE.md` |
| New external dependency | `WORKSPACE.md` (external dependencies section) |
| Recurring code pattern | New `.ai/rules/*.md` or update an existing one |
| New agentic workflow | New `.ai/skills/<name>/SKILL.md` |

## Adding an ADR

1. Copy `adr/000-template.md` to `adr/NNN-short-title.md` (next sequential number)
2. Fill in all sections using the template
3. Add a row to the index table in `adr/README.md`
4. If the decision changes the current system state, update the relevant section in `ARCHITECTURE.md`

If a decision is superseded, do not delete the old file — change its status to
`Superseded by #N` and create a new ADR.

## Updating ARCHITECTURE.md

`ARCHITECTURE.md` describes **what the system is now**, not why. Update it when:
- The stack, data model, or API surface changes
- A planned section (marked TBD) becomes decided
- A new structural component is added

Do not add decision rationale to `ARCHITECTURE.md` — that belongs in `adr/`.

## Updating WORKSPACE.md

WORKSPACE.md is the developer and agent onboarding doc. Keep it accurate, not exhaustive.
Update the relevant section inline — do not append to the bottom.

After any change, verify:
- [ ] Port table is correct
- [ ] Environment variable list is current
- [ ] "Never Edit" list includes any new generated files
- [ ] Cross-repo change protocol still accurate

## Adding a New Rule

When a pattern appears more than once in implementation, codify it as a rule.

1. Create `.ai/rules/<descriptive-name>.md`
2. Note the file glob scope in the first line (e.g., "Applies to: `cloudtalk_homework_be/**/*.ts`")
3. Keep it under 50 lines; use concrete `✅ / ❌` examples

## Adding a New Skill

When a multi-step workflow recurs (e.g., "add a new domain entity end-to-end"),
create a skill:

1. Create `.ai/skills/<name>/SKILL.md`
2. First paragraph: third-person description of WHAT the skill does and WHEN to use it
3. Keep SKILL.md under 500 lines; link to supplementary files if needed

## Quality Check Before Finishing

- [ ] Every new decision in ARCHITECTURE.md has a number and date
- [ ] WORKSPACE.md reflects the current state of the system (ports, env vars, conventions)
- [ ] New rules have concrete code examples, not abstract prose
- [ ] New skills have trigger conditions in their description
