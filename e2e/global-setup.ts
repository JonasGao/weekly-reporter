import { startScriptedAI, SCRIPTED_AI_PORT } from './scripted-ai'

export default async function globalSetup() {
  const service = await startScriptedAI(SCRIPTED_AI_PORT)
  return async () => service.close()
}
