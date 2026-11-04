import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

function harness({ readOnly = true } = {}) {
  const commands = new Map()
  const state = new WeakMap()
  let prompt
  const ctx = {
    commands: { register(command) { commands.set(command.name, command) } },
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
