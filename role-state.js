export const roleKey = 'ollamaAgentRole'

export function roleFromCommand(name, args = '') {
  if (name === 'organize') return 'organize'
  if (name === 'agent-plan') return 'plan'
  if (name === 'agent-build') return 'build'
  if (name === 'agent-role' && ['organize', 'plan', 'build'].includes(args.trim().toLowerCase())) {
    return args.trim().toLowerCase()
  }
  return undefined
}

export function reduceRole(state, event) {
  if (event.type === 'plan/mode' && !event.data.active && state.role === 'plan') {
    return { ...state, role: 'organize' }
  }
  if (event.type === 'command/run') {
    const role = roleFromCommand(event.data.name, event.data.args)
    if (role) return { ...state, running: { commandId: event.data.commandId, role } }
  }
  if (event.type === 'command/done' && state.running?.commandId === event.data.commandId) {
    return { role: event.data.kind === 'success' ? state.running.role : state.role, running: null }
  }
  return state
}
