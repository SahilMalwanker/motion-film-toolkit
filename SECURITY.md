# Security and data safety

Motion Film is a **local creative toolkit**, not an authenticated production web service.
Its server binds to 127.0.0.1, checks host and save origins, and restricts saves to the screenshot
and output directories. Do not expose it through a public tunnel or proxy, or bind it to a public interface.

## Your screens are your data

- Prefer demo or synthetic data. Review every screenshot for credentials, personal data and private URLs.
- Capture plans, browser session-state files, private briefs and environment files should stay local.
- The ignore rules help avoid accidental inclusion; they do not scan files or remove data already shared.
- Review imported logos, fonts and screenshots for both confidentiality and redistribution rights.
- Only the deliberate public demo assets should enter the README gallery.

The static [project page](docs/index.html) is separate from the local film application.
Static hosting can display that page, but cannot replace the Python server's save endpoints.

## Reporting a suspected vulnerability

If this project is hosted on GitHub and private vulnerability reporting is enabled, use
**Security → Report a vulnerability**. Otherwise, request a private reporting channel without
posting exploit details, private captures or secrets in a public issue.

Include the affected component, reproduction steps using synthetic data, the browser and Python
versions, and the potential impact. Remove tokens, session cookies, internal addresses and identifiers.
There is no published response-time commitment or independently audited security certification.