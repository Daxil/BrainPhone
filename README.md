# BrainPhone

## 🔐 Сканирование секретов (pre-commit)

gitleaks-хук ловит секреты локально ещё до коммита — тот же пин `8.30.1` и allowlist `.gitleaks.toml`, что и в CI-гейте (`.github/workflows/test.yml`, job `secret-scan`). Разово на клон:

```bash
pipx install pre-commit    # или: sudo apt install pre-commit
pre-commit install
```

Чтобы хук ставился автоматически на будущих `git clone` (разово на машину):

```bash
git config --global init.templateDir ~/.git-template
pre-commit init-templatedir ~/.git-template
```

Хук запускает `gitleaks protect --staged` на каждом коммите. Обойти (не рекомендуется) — `git commit --no-verify`; источник истины остаётся CI-гейт.
