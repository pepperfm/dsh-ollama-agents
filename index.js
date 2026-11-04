/**
 * DeepSeek Harness: organize / plan / build roles.
 * Zero runtime dependencies. DSH owns permissions, prompts, commands and plan state.
 */
export const name = 'ollama-agents'
export const inject = ['commands', 'systemPrompt', 'planMode', 'permissionPresets']

const roles = new WeakMap()

const guidance = {
  organize: [
    'Текущая роль: ORGANIZE.',
    'Помогай поддерживать независимую базу знаний, список проектов, карточки, расследования и планы.',
    'Прежде чем менять записи, проверь существующий реестр и правила AGENTS.md.',
    'Не путай локальную копию кода, статус проекта, степень проверки документации и факт продакшн-развёртывания.',
    'Файлы с исходниками остаются в отдельных репозиториях; абсолютные пути компьютера — в его локальной конфигурации.',
    'Не добавляй неизвестные факты и не превращай запланированные изменения в выполненные.',
    'Изменения в KB допустимы с действующими подтверждениями DSH; не редактируй продакшн.'
  ].join(' '),
  plan: [
    'Текущая роль: PLAN.',
    'Исследуй, сравнивай альтернативы и выдавай проверяемый план: шаги, риски, критерии готовности, тесты и откат.',
    'Ничего не изменяй, не выполняй команды с побочными эффектами и не считай недоступные источники проверенными.',
    'Если план касается серверов, БД, .env или ключей, отделяй диагностику, подготовку и выполнение.',
    'Возможности и реальная граница доступа задаются отдельно системой permissions/sandbox DSH.'
  ].join(' '),
  build: [
    'Текущая роль: BUILD.',
    'Изучи AGENTS.md и стиль целевого проекта, затем работай минимальными проверяемыми изменениями.',
    'Показывай результат и запускай подходящие тесты; отмечай непроверенные части.',
    'Не выполняй коммиты или push без прямого запроса.',
    'Изменения на продакшне, SSH-команды, смена DNS, APP_KEY, конфигов, операций с БД требуют отдельного явного согласования и технических ограничений инструментов.',
    'Не сохраняй секреты в KB или логах.'
  ].join(' ')
}

function currentRole(ctx, agent) {
  if (!agent) return 'organize'
  const planState = ctx.planMode.get(agent)
  if (planState.pending ?? planState.active) return 'plan'
  return roles.get(agent) ?? 'organize'
}

function selectRole(ctx, agent, role) {
  // Fail closed before changing the session: never silently fall back to Full access.
  const preset = role === 'plan' ? 'read-only' : 'workspace-write'
  try {
    ctx.permissionPresets.resolve(preset)
  } catch {
    return { kind: 'error', text: `Нужен пресет DSH "${preset}". Проверь настройки Permissions.` }
  }
  try {
    ctx.permissionPresets.set(agent.session, preset)
    ctx.planMode.set(agent, role === 'plan')
    roles.set(agent, role)
    return { kind: 'success', text: `Режим ${role.toUpperCase()} включён. DSH Permissions: ${preset}.` }
  } catch (error) {
    return { kind: 'error', text: `Не удалось изменить роль: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'workspace:agent-role',
    order: 80,
    interpolate: false,
    text: (context) => {
      if (!context.agent) return ''
      return guidance[currentRole(ctx, context.agent)]
    }
  })

  const choose = (role) => ({ agent }) => selectRole(ctx, agent, role)

  ctx.commands.register({
    name: 'organize',
    description: 'Организация знаний и проектов',
    handler: choose('organize')
  })
  ctx.commands.register({
    name: 'agent-plan',
    description: 'Планирование, без изменений файлов',
    handler: choose('plan')
  })
  ctx.commands.register({
    name: 'agent-build',
    description: 'Разработка, проверки и контролируемые правки',
    handler: choose('build')
  })
  ctx.commands.register({
    name: 'agent-role',
    description: 'Показать или выбрать режим (organize / plan / build)',
    input: { hint: 'organize | plan | build' },
    handler: ({ agent, rawInput }) => {
      const role = rawInput.trim().toLowerCase()
      if (!role) {
        return { kind: 'success', text: `Текущая роль: ${currentRole(ctx, agent).toUpperCase()}.` }
      }
      if (!Object.hasOwn(guidance, role)) {
        return { kind: 'error', text: 'Доступные роли: organize, plan, build.' }
      }
      return selectRole(ctx, agent, role)
    }
  })
}
