<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:database-rules -->
# Database Schema Rules

## Schema Organisation
- Every domain has its own schema file in `db/schemas/` — e.g. `user.schema.ts`, `product.schema.ts`, `order.schema.ts`
- Never combine multiple unrelated models into a single schema file
- The glob `./db/schemas/*.ts` in `drizzle.config.ts` picks them all up automatically — no registration needed

## Making Schema Changes
1. Edit the relevant `db/schemas/*.schema.ts` file
2. Run `npx drizzle-kit generate` to generate a new migration file in `db/migrations/`
3. Review the generated SQL in `db/migrations/` — verify the changes look correct before applying
4. Run `npx drizzle-kit migrate` to apply it to the database
5. Never use `drizzle-kit push` — always go through the generate → migrate flow to maintain a proper migration history
<!-- END:database-rules -->

<!-- BEGIN:commit-conventions -->
# Commit Message Conventions

After completing **any** task — code changes, config updates, documentation edits, refactors, bug fixes — always suggest a Conventional Commits-formatted commit message using the `conventional-commits` skill located at `.agents/skills/conventional-commits/`.

Never finish a task without suggesting a commit message. This is non-negotiable.
<!-- END:commit-conventions -->
