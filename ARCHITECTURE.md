# Architecture

## Layers

```
Web UI
  ↓
FastAPI
  ↓
Routes
  ↓
Services
  ↓
Scanner
  ↓
AI
  ↓
Attack (Asking)
  ↓
Reports
```

main.py only bootstraps the application.
Routes contain HTTP endpoints.
Services contain business logic.
Scanner wraps external tools.
AI contains Ollama integration.
