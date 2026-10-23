'use client'

import { WhopCheckoutEmbed } from '@whop/checkout/react'

export default function WhopCheckoutPanel({
  sessionId,
  returnUrl,
  environment = 'production',
}: {
  sessionId: string
  returnUrl: string
  environment?: 'production' | 'sandbox'
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a2926]">
      <WhopCheckoutEmbed
        sessionId={sessionId}
        returnUrl={returnUrl}
        environment={environment}
        theme="dark"
        adaptivePricing
        themeOptions={{ backgroundColor: '#0a2926', accentColor: '#d8b45a', borderRadius: 14 }}
      />
    </div>
  )
}
