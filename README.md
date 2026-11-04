# DSH Ollama Agents

Минимальный плагин DeepSeek Harness для трёх рабочих ролей **Organize / Plan / Build**. Он не запускает OpenCode, не устанавливает Ollama и не хранит модели. Название связано с локальной установкой через Ollama, но роли не зависят от конкретного LLM-провайдера. Предназначен для работы с независимыми Markdown/YAML workspace (например, `pepperfm/agent-workspace`) и с реальными исходниками, расположенными вне KB.

**Версия 0.1.0: slash-команды через штатный интерфейс DSH, без отдельного графического селектора. Реальная загрузка Desktop ещё не проверена.** Следующий этап — полноценный переключатель ролей в UI после проверки Desktop-совместимости.

## Режимы

| Роль | Назначение | DSH Plan | DSH Permissions |
| --- | --- | --- | --- |
| Organize | Структурирование KB, карточки проектов, планы, решения | Off | Workspace Write (с подтверждениями) |
| Plan | Исследование и подготовка плана без записи | On | Read Only |
| Build | Изменения локальных файлов, тесты и разработка | Off | Workspace Write (с подтверждениями) |

Права переключаются **реальными механизмами DSH**, а не только текстом инструкций. Смена роли не даёт разрешения на продакшн, SSH, DNS, изменение БД или секретов. Sandbox и подтверждения DSH — дополнительная граница, а не полный контроль доступа к сети и чтению секретов.

## Команды

- `/organize` — организатор знаний
- `/agent-plan` — планирование с Read Only
- `/agent-build` — разработка в Workspace Write
- `/agent-role` — текущая роль; `/agent-role organize|plan|build` — выбор по имени

Команды доступны в стандартном меню команд DSH. Встроенная `/plan` остаётся доступной отдельно: плагин учитывает реальное состояние native Plan Mode при выборе текстовых инструкций.

Если в текущем профиле нет встроенных `planMode`, `permissionPresets` или пресета `read-only`, команда не должна молча повышать права: при отсутствии нужного пресета она возвращает ошибку.

## Установка в DSH

Формат пакета следует официальному DSH bundle: `package.json#dsh.bundle.patch` и `cordis.patch.yml`. Для Desktop-профиля:

```bash
dsh plugin --profile desktop add "github:pepperfm/dsh-ollama-agents#master"
```

Перезапусти Web/desktop runtime, если он не выполнил hot reload. Репозиторий публичный, GitHub-токен для его чтения не нужен. При установке через UI DSH Desktop укажи `github:pepperfm/dsh-ollama-agents#master`. Понадобится установленный Git и доступ к github.com.

Альтернатива при локальном клоне (путь в примере заменяется на настоящий):

```bash
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-ollama-agents"
```

Для диагностики композиции: `dsh web --dump-config`. **Не пытайся подключать исходный репозиторий как обычный MCP-сервер**: это DSH bundle.

## Ограничения v0.1

- Роль Organize/Build хранится только на время жизни текущего процесса/агента; после перезапуска начинается Organize. Native Plan восстанавливается собственным механизмом DSH.
- Изменения режима рекомендуется делать между генерациями, не посреди выполнения команд.
- Инструкции ролей не заменяют правила `AGENTS.md` конкретного репозитория и реальные permission checks.
- Отдельного красивого визуального переключателя пока **нет**. Сейчас это доступные из UI slash-команды; отдельная панель будет второй версией.
- Плагин не проверялся в установленном пользователем экземпляре DSHA на Windows. Автотесты ниже проверяют логику с mock-контекстом, но не интеграцию с Desktop.

## Проверка разработки

```bash
node --test
```

Зависимости для обычных тестов не требуются; плагин использует сервисы, предоставляемые запущенным DSH. Тесты не выполняют команд на реальных серверах.

Источники API: [Human Commands](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/commands), [Plan Mode](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/plan), [Permission Presets](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/permission-presets), [System Prompt](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/system-prompt).
