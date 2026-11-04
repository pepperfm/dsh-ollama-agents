import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function client({ role = 'organize', plan, running = false, response } = {}) {
  let plugin, component, registration
  const calls = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [value, () => {}],
    useRef: (value) => ({ current: value }),
    useEffect() {}
  }
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(value) { plugin = value.factory(() => React) } } }
  })
  plugin.apply({
    effect() {},
    slots: {
      inject(name, mount) { mount() },
      register(value, render) { registration = value; component = render }
    },
    remote: { commands: { async execute(...args) {
      calls.push(args)
      return response ?? { ok: true, value: { result: { kind: 'success' } } }
    } } }
  })
  const props = registration.inject('session-1')
  const tree = component({ ...props, useSession: () => running, useProjection: (key) => key === 'plan' ? plan : { role } })
  return { tree, select: props.select, calls, registration }
}

test('role picker uses the additive composer slot and session-bound command', async () => {
  const c = client({ role: 'build' })
  assert.equal(c.registration.name, 'conversation.input.left')
  assert.equal(c.tree.children[0].props.value, 'build')
  await c.select('plan')
  assert.equal(c.calls[0][0], 'session-1')
  assert.equal(c.calls[0][1], '/agent-role plan')
  assert.equal(c.calls[0][2].length, 0)
})

test('native Plan overrides stored role, including pending exit', () => {
  assert.equal(client({ role: 'build', plan: { active: true, pending: false } }).tree.children[0].props.value, 'plan')
  assert.equal(client({ role: 'build', plan: { active: true, pending: true } }).tree.children[0].props.value, 'build')
  assert.equal(client({ role: 'plan', plan: { active: false, pending: false } }).tree.children[0].props.value, 'organize')
})

test('picker blocks role changes during generation', () => {
  assert.equal(client({ running: true }).tree.children[0].props.disabled, true)
})

test('host refusal and missing command reject instead of displaying optimistic success', async () => {
  await assert.rejects(client({ response: { ok: true, value: { result: { kind: 'error', text: 'Plan unavailable' } } } }).select('plan'), /Plan unavailable/)
  await assert.rejects(client({ response: { ok: true } }).select('plan'), /недоступна/)
  await assert.rejects(client({ response: { ok: false, error: { message: 'Disconnected' } } }).select('plan'), /Disconnected/)
})
