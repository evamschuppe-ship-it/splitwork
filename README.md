# SplitWork

SplitWork helps university project teams automatically divide deliverable sections and milestones into balanced timelines, so no single student has to shoulder all the project management and admin work.

## What it does
- Optionally upload the teacher's brief (.docx/.pptx): its headings, slide titles and grade weights become the sections to split, and the due date / group size are detected. The file is stored privately for the team.
- Create a project workspace with just a title (defaults: team of 4, due in 14 days, "Standard Research & Presentation" template).
- SplitWork gives each teammate a self-contained part they own end to end (dependent steps such as collect → analyse stay with one person; big chains are split by sub-topic), one editor joins the parts after the hand-in date, and shared milestones belong to everyone. Weekly check-ins go to whoever has the least work.
- Invite teammates by email: everyone invited sees the assigned tasks, milestones, progress and the shared document link.

## Stack
Next.js (App Router) · Supabase Auth + Postgres with Row Level Security · Vercel.

## Run locally
1. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Run `supabase/schema.sql`, then `supabase/002_briefs.sql` and `supabase/003_owned_split.sql`, in Supabase → SQL Editor.
3. `npm install && npm run dev`, then open http://localhost:3000.
