# limengge426.github.io

Personal site of Limeng Ge. Plain HTML, CSS and JavaScript with no build step, so GitHub Pages serves it as is.

| Page | What's on it |
|---|---|
| `index.html` | Bio, news, selected publications |
| `research.html` | Research threads and all publications, with filters |
| `internships.html` | Internships (timeline, metrics, details) and toolbox |
| `projects.html` | Projects (DeepTrace and others) |
| `lab.html` | Syllogism Lab: a game based on the AAAI 2026 paper (`assets/js/lab.js`) |

Shared styles are in `assets/css/style.css` and shared interactions (dark-mode cord, typing line, click symbols) in `assets/js/main.js`.

## Common edits

- **Photo**: save a 4:5 portrait as `assets/img/photo.jpg`. Until then a monogram card is shown.
- **News**: add a new `<li class="news__item">` at the top of the list in `index.html`. Items with `is-more` stay hidden until "Show more" is clicked.
- **CV**: replace `assets/Limeng_Ge_CV.pdf`.

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
