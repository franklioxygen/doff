# Error Log

## [ERR-20260322-001] npm_install_vite_plugin_pwa

**Logged**: 2026-03-22T05:21:19Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Installing `vite-plugin-pwa` failed due to Vite peer dependency mismatch.

### Error
`vite-plugin-pwa@1.2.0` requires `vite ^3 || ^4 || ^5 || ^6 || ^7`, but scaffolded project uses `vite@8.0.1`.

### Context
- Command: `npm install -D vite-plugin-pwa`
- Project scaffolded with Vite 8 template.
- Non-interactive environment.

### Suggested Fix
Downgrade Vite to v7-compatible versions or install plugin with legacy peer deps after validating runtime.

### Metadata
- Reproducible: yes
- Related Files: package.json

---
