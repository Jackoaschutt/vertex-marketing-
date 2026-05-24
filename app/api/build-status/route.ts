import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const filePath = path.join(process.cwd(), 'build-status.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
