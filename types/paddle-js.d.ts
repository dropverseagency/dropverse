declare module '@paddle/paddle-js' {
  export type Paddle = {
    Checkout?: { open: (opts: Record<string, unknown>) => void }
  }
  export function initializePaddle(opts: {
    token: string
    environment?: 'sandbox' | 'production'
  }): Promise<Paddle | undefined>
}
