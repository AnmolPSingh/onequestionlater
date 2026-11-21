# What Anmol AI knows, beyond the site

Anmol AI answers from three places, all searched for each question:

1. `api/_knowledge.js`: the core facts. Its first two sections (who Anmol is, what he helps with) go with every question.
2. `src/content/work/*.md`: every project page. "What I found", "What I tried" and "The next question" count as learnings.
3. This folder. Any `.md` file here is indexed on the next deploy, split at its `## ` headings.

`learnings.md` is special: everything in it counts as a learning, pulled in when a visitor describes a problem, so Anmol AI can say how something similar went. `method.md` (how I work through a problem with someone) is pulled in the same way, so it can lead a brief the way I would. `services.md`, `patterns.md` and `ideas.md` (charity-sector ideas I'm exploring, not products yet) are ordinary facts.

Never name a client or colleague here. List those names in `.private-names` (copy `.private-names.example`; it's never committed) and in `PRIVATE_NAMES` on Vercel: if any passage mentions one, nothing is indexed and the build fails.

To teach it something new, add a `## ` section to a file here and deploy. Check `/insights` for the questions it couldn't answer: those are the gaps worth filling. It never learns facts from visitors.

Write in Anmol's voice, first person, no em dashes, and only what's true and public.
