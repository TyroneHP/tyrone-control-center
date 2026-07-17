import { createServer } from 'vite'

const appUrl = 'http://127.0.0.1:5173/login'

async function existingServerIsReady() {
  try {
    return (await fetch(appUrl)).ok
  } catch {
    return false
  }
}

export default async function globalSetup() {
  if (await existingServerIsReady()) return

  process.env.VITE_SUPABASE_URL ??= 'http://127.0.0.1:54321'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??=
    'sb_publishable_your-placeholder-key'

  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
  })
  await server.listen()

  return async () => {
    await server.close()
  }
}
