'use client'

import { useState } from 'react'
import AddAccountModal from './AddAccountModal'
import type { PropFirmRule } from '@/types'

interface Props {
  firmOptions: PropFirmRule[]
  userId: string
}

export default function AddAccountButton({ firmOptions, userId }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
      >
        + Add Account
      </button>

      <AddAccountModal
        open={open}
        onClose={() => setOpen(false)}
        firmOptions={firmOptions}
        userId={userId}
      />
    </>
  )
}
