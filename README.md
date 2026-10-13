# APS Review · Multimedia Graphic Design

A static study app for the APS interview: course notes, mind maps, a "What I did" note per course, and 13 interactive tests (12 course tests of 30 questions, plus a 25-question mixed review).

No build step and no backend. Content lives in `data/`, and the page reads it every time it opens.

## Deploy (GitHub + Vercel)

1. Create a new GitHub repository and push this folder to it.
2. In Vercel, choose **Add New → Project**, import the repository, keep the framework preset as **Other**, and deploy. No build command or output directory is needed.
3. Every push to the main branch redeploys automatically, usually in under a minute.

`vercel.json` sends `Cache-Control: no-cache` for `data/`, so content changes show on the next page load.

## Updating content

| What to change | File |
| --- | --- |
| A course's notes, outline, mind map or interview questions | `data/courses/<course-id>.md` (Markdown) |
| A test question or its answer | `data/tests/<test-id>.json` |
| Study plan, mock interview, references | `data/pages/*.md` |
| Course list, titles, grades, which test belongs to which course | `data/manifest.json` |

Mind maps are Mermaid code blocks (```` ```mermaid ````) inside the Markdown files.

### Test file format

```json
{
  "id": "03-game-design",
  "title": "Game Design",
  "course": "game-design",
  "target": 24,
  "questions": [
    {
      "q": "MDA stands for…",
      "options": ["Mechanics, Dynamics, Aesthetics", "Motion, Design, Animation", "Media, Data, Audio", "Mechanics, Design, Art"],
      "answer": 0
    }
  ]
}
```

`answer` is the index of the correct option: 0 = A, 1 = B, 2 = C, 3 = D. If you add or remove questions, update `count` for that test in `data/manifest.json`.

## Your notes and scores

"What I did" notes, best scores and attempt history are saved in the browser (localStorage), so each device keeps its own. Use **Back up notes and scores** in the sidebar to download them as a JSON file.

## Preview locally

The page loads its data with `fetch`, so opening `index.html` directly from disk will not work. Run a small local server from this folder instead:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Source

The content was exported from the Claude Doc "APS Review — Multimedia Graphic Design". The Doc stays the editable notebook; this repo is the study-and-test app.
