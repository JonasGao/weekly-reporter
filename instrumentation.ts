export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initializeSnippets } = await import('./src/lib/init-snippets')
      await initializeSnippets()
    } catch (error) {
      console.error('Failed to initialize built-in snippets:', error)
    }
    try {
      const { initializeBuiltInTags } = await import('./src/lib/init-tags')
      await initializeBuiltInTags()
    } catch (error) {
      console.error('Failed to initialize built-in tags:', error)
    }
  }
}