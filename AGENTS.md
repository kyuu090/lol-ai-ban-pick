# Agent Notes

- This repository contains Japanese Markdown files encoded as UTF-8 without BOM.
- When reading Markdown or docs from PowerShell 5.1, always specify UTF-8 explicitly, for example:

```powershell
Get-Content README.md -Encoding UTF8
Get-Content "docs\<markdown-file>.md" -Encoding UTF8
```

- Do not treat mojibake from plain `Get-Content` as file corruption. Verify by reading bytes or decoding as UTF-8 first.
