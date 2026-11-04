window.__ModuleLoader__.load({
  id: 'dsh-ollama-agents',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    function RolePicker({ useProjection, useSession, select }) {
      const stored = useProjection('ollamaAgentRole')
      const plan = useProjection('plan')
      const running = useSession((state) => state.running || state.removed)
      const [pending, setPending] = React.useState(false)
      const [error, setError] = React.useState(null)
      const mounted = React.useRef(true)
      React.useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
      }, [])
      const planActive = plan && (plan.pending ? !plan.active : plan.active)
      const role = planActive ? 'plan' : stored?.role === 'plan' ? 'organize' : stored?.role ?? 'organize'
      const change = async (event) => {
        const next = event.target.value
        setPending(true)
        setError(null)
        try {
          await select(next)
        } catch (failure) {
          if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure))
        } finally {
          if (mounted.current) setPending(false)
        }
      }
      return h('span', { className: 'dsh-agent-role' },
        h('select', {
          'aria-label': 'Роль агента',
          title: 'Organize — знания · Plan — только чтение · Build — разработка',
          value: role,
          disabled: pending || running,
          onChange: change
        },
        h('option', { value: 'organize' }, 'Organize'),
        h('option', { value: 'plan' }, 'Plan'),
        h('option', { value: 'build' }, 'Build')),
        pending ? h('span', { role: 'status' }, 'Переключение…') : null,
        error ? h('span', { role: 'alert', className: 'dsh-agent-role-error' }, error) : null
      )
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style')
        style.textContent = '.dsh-agent-role{display:inline-flex;align-items:center;gap:6px;max-width:100%;font:inherit}.dsh-agent-role select{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-floating-fill,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:5px 8px;font:inherit;font-size:12px;cursor:pointer;max-width:130px}.dsh-agent-role select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.dsh-agent-role select:disabled{opacity:.5;cursor:default}.dsh-agent-role select option{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-background-primary,#222)}.dsh-agent-role-error{font-size:12px;color:var(--dsw-alias-label-primary);max-width:260px;overflow-wrap:anywhere}'
        document.head.appendChild(style)
        return () => style.remove()
      })
      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left',
        id: 'ollama-agent-role',
        order: -20,
        inject: (sessionId) => ({
          select: async (role) => {
            const result = await ctx.remote.commands.execute(sessionId, `/agent-role ${role}`, [])
            if (!result.ok) throw new Error(result.error.message)
            if (!result.value) throw new Error('Команда /agent-role недоступна. Проверь плагин.')
            if (result.value.result.kind === 'error') throw new Error(result.value.result.text)
          }
        })
      }, RolePicker))
    }

    return { inject: ['slots', 'remote', 'remote.commands', 'sessions'], apply }
  }
})
