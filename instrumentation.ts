export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize built-in snippets on server startup
    // Dynamic import to avoid Edge Runtime compatibility issues
    try {
      const { initializeSnippets } = await import('./src/lib/init-snippets')
      await initializeSnippets()
    } catch (error) {
      console.error('Failed to initialize built-in snippets:', error)
      // Don't throw - allow the app to start even if initialization fails
    }
  }
}