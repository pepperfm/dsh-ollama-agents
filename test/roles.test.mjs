import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject } from '../index.js'
import { reduceRole } from '../role-state.js'

function harness({ readOnly = true, scoped = true, planning = true } = {}) {
  const commands = new Map()
  const state = new WeakMap()
  let prompt
  let projection
  const sessions = new WeakMap()
  let sequence = 0
  const ctx = {
    commands: { register(command) {
      commands.set(command.name, { ...command, handler(input) {
        const commandId = String(++sequence)
        let value = sessions.get(input.agent?.session) ?? projection.init()
        value = projection.apply(value, { type: 'command/run', data: { name: command.name, args: input.rawInput ?? '', commandId } })
        const result = command.handler(input)
        value = projection.apply(value, { type: 'command/done', data: { commandId, kind: result.kind } })
        if (input.agent) sessions.set(input.agent.session, value)
        return result
      } })
    } },
    sessionProjections: {
      register(definition) { projection = definition },
      stateOf(session) { return sessions.get(session) ?? projection.init() }
    },
    systemPrompt: { section(s) { prompt = s } },
    planMode: {
      get(agent) { return { active: state.get(agent) ?? false } },
      set(agent, active) { state.set(agent, active) }
    },
    permissionPresets: {
      resolve(name) { if (name === 'read-only' && !readOnly) throw Error('missing'); return {} },
      set(session, name) { session.permission = name }
    }
  }
  const planMode = ctx.planMode
  if (scoped) {
    ctx.agentPresets = { serviceFor(agent, name) { return planning && name === 'planMode' ? planMode : undefined } }
    delete ctx.planMode
  } else if (!planning) {
    delete ctx.planMode
  }
  ctx.get = (name) => ctx[name]
  apply(ctx)
  const agent = { session: {}, options: {} }
  return { agent, commands, getPrompt: () => prompt.text({ agent }), ctx }
}

test('organization is initial role and visible in prompt', () => {
  const h = harness()
  assert.match(h.getPrompt(), /ORGANIZE/)
  assert.match(h.commands.get('agent-role').handler({ agent: h.agent, rawInput: '' }).text, /ORGANIZE/)
})

test('build switches native permissions and prompt', () => {
  const h = harness()
  const res = h.commands.get('agent-build').handler({ agent: h.agent })
  assert.equal(res.kind, 'success')
  assert.equal(h.agent.session.permission, 'workspace-write')
  assert.match(h.getPrompt(), /BUILD/)
})

test('plan uses native plan mode and read-only permission', () => {
  const h = harness()
  const res = h.commands.get('agent-plan').handler({ agent: h.agent })
  assert.equal(res.kind, 'success')
  assert.equal(h.agent.session.permission, 'read-only')
  assert.match(h.getPrompt(), /PLAN/)
  h.commands.get('organize').handler({agent:h.agent})
  assert.match(h.getPrompt(), /ORGANIZE/)
})

test('missing read-only preset refuses unsafe fallback', () => {
  const h = harness({readOnly:false})
  const res = h.commands.get('agent-plan').handler({agent:h.agent})
  assert.equal(res.kind, 'error')
  assert.equal(h.agent.session.permission, undefined)
})

test('unknown role is not accepted', () => {
  const h = harness()
  const res = h.commands.get('agent-role').handler({agent:h.agent,rawInput:'root'})
  assert.equal(res.kind, 'error')
  assert.match(h.getPrompt(), /ORGANIZE/)
})


test('host plugin activates without a host Plan Mode dependency', () => {
  assert.deepEqual(inject, ['commands', 'systemPrompt', 'permissionPresets', 'sessionProjections'])
  const h = harness()
  assert.equal(h.ctx.planMode, undefined)
  assert.equal(h.commands.get('agent-plan').handler({ agent: h.agent }).kind, 'success')
})

test('preset without planning refuses every switch before permissions change', () => {
  const h = harness({ planning: false })
  for (const name of ['agent-plan', 'agent-build', 'organize']) {
    assert.equal(h.commands.get(name).handler({ agent: h.agent }).kind, 'error')
    assert.equal(h.agent.session.permission, undefined)
  }
  assert.match(h.getPrompt(), /ORGANIZE/)
})

test('preset-free compositions use native host Plan Mode', () => {
  const h = harness({ scoped: false })
  assert.equal(h.commands.get('agent-plan').handler({ agent: h.agent }).kind, 'success')
  assert.match(h.getPrompt(), /PLAN/)
})

test('each session resolves its own preset Plan Mode', () => {
  const h = harness()
  const other = { session: {} }
  h.ctx.agentPresets.serviceFor = (agent) => agent === h.agent ? {
    get: () => ({ active: true, pending: false }),
    set() {}
  } : { get: () => ({ active: true }), set() {} }
  assert.match(h.getPrompt(), /ORGANIZE/)
  assert.match(h.commands.get('agent-role').handler({ agent: other, rawInput: '' }).text, /PLAN/)
})


test('role projection restores successful selection and ignores failed commands', () => {
  const run = (state, id, role, kind) => reduceRole(
    reduceRole(state, { type: 'command/run', data: { name: 'agent-role', args: role, commandId: id } }),
    { type: 'command/done', data: { commandId: id, kind } }
  )
  const built = run({ role: 'organize', running: null }, '1', 'build', 'success')
  assert.deepEqual(JSON.parse(JSON.stringify(built)), { role: 'build', running: null })
  assert.deepEqual(run(built, '2', 'plan', 'error'), built)
  assert.deepEqual(run(built, '3', '', 'success'), built)
})

test('native Plan exit resets the Plan role without discarding Build', () => {
  const event = { type: 'plan/mode', data: { active: false } }
  assert.equal(reduceRole({ role: 'plan', running: null }, event).role, 'organize')
  assert.equal(reduceRole({ role: 'build', running: null }, event).role, 'build')
})
