import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"

type Tokens = {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

type Metrics = {
  version: 1
  startedAt: string
  updatedAt: string
  sessionIDs: string[]
  elapsedMs: number
  steps: number
  cost: number
  tokens: Tokens
  toolCalls: Record<string, { count: number; success: number; failed: number; ms: number }>
  skills: Record<string, { count: number; success: number; failed: number; ms: number }>
  compactions: number
  models: Record<string, number>
  pr?: string
  branch?: string
  phase?: string
}

const zeroTokens = (): Tokens => ({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })

export default (async () => {
  const file = process.env.OPENCODE_AGENT_LOOP_METRICS_FILE
  if (!file) return {}

  const started = Date.now()
  const metrics: Metrics = {
    version: 1,
    startedAt: new Date(started).toISOString(),
    updatedAt: new Date(started).toISOString(),
    sessionIDs: [],
    elapsedMs: 0,
    steps: 0,
    cost: 0,
    tokens: zeroTokens(),
    toolCalls: {},
    skills: {},
    compactions: 0,
    models: {},
    pr: process.env.OPENCODE_AGENT_LOOP_PR,
    branch: process.env.OPENCODE_AGENT_LOOP_BRANCH,
    phase: process.env.OPENCODE_AGENT_LOOP_PHASE,
  }
  const toolStarts = new Map<string, number>()
  const skillByCall = new Map<string, string>()
  let writing = Promise.resolve()

  const rememberSession = (sessionID?: string) => {
    if (sessionID && !metrics.sessionIDs.includes(sessionID)) metrics.sessionIDs.push(sessionID)
  }

  const save = () => {
    metrics.elapsedMs = Date.now() - started
    metrics.updatedAt = new Date().toISOString()
    writing = writing.then(async () => {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, `${JSON.stringify(metrics, null, 2)}\n`)
    }).catch(() => {})
    return writing
  }

  const bucket = (name: string, map: Metrics["toolCalls"]) => {
    map[name] ??= { count: 0, success: 0, failed: 0, ms: 0 }
    return map[name]
  }

  const addToolEnd = (tool: string, callID: string, ok: boolean) => {
    const b = bucket(tool, metrics.toolCalls)
    b.count += 1
    if (ok) b.success += 1
    else b.failed += 1
    const start = toolStarts.get(callID)
    if (start) b.ms += Math.max(0, Date.now() - start)

    const skill = skillByCall.get(callID)
    if (skill) {
      const s = bucket(skill, metrics.skills)
      s.count += 1
      if (ok) s.success += 1
      else s.failed += 1
      if (start) s.ms += Math.max(0, Date.now() - start)
    }
    toolStarts.delete(callID)
    skillByCall.delete(callID)
  }

  const skillName = (args: any) => {
    if (!args || typeof args !== "object") return undefined
    return [args.name, args.skill, args.skillName].find((value) => typeof value === "string")
  }

  return {
    event: async ({ event }) => {
      const props = (event as any).properties ?? {}
      rememberSession(props.sessionID)

      if (event.type === "session.next.step.started") {
        const model = props.model?.providerID && props.model?.id ? `${props.model.providerID}/${props.model.id}` : props.model?.id
        if (model) metrics.models[model] = (metrics.models[model] ?? 0) + 1
      }

      if (event.type === "session.next.step.ended") {
        metrics.steps += 1
        metrics.cost += Number(props.cost ?? 0)
        metrics.tokens.input += Number(props.tokens?.input ?? 0)
        metrics.tokens.output += Number(props.tokens?.output ?? 0)
        metrics.tokens.reasoning += Number(props.tokens?.reasoning ?? 0)
        metrics.tokens.cache.read += Number(props.tokens?.cache?.read ?? 0)
        metrics.tokens.cache.write += Number(props.tokens?.cache?.write ?? 0)
        await save()
      }

      if (event.type === "session.next.compaction.ended") {
        metrics.compactions += 1
        await save()
      }
    },
    "tool.execute.before": async (input, output) => {
      rememberSession(input.sessionID)
      toolStarts.set(input.callID, Date.now())
      const name = input.tool === "skill" ? skillName(output.args) : undefined
      if (name) skillByCall.set(input.callID, name)
      await save()
    },
    "tool.execute.after": async (input) => {
      rememberSession(input.sessionID)
      const name = input.tool === "skill" ? skillName(input.args) : undefined
      if (name) skillByCall.set(input.callID, name)
      addToolEnd(input.tool, input.callID, true)
      await save()
    },
    dispose: async () => {
      await save()
      await writing
    },
  }
}) satisfies Plugin
