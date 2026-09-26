// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    console.log('LOGIN attempt:', { email, hasPassword: !!password })

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const user = await login(email, password)
    console.log('LOGIN success:', user.id)
    return NextResponse.json({ user })
  } catch (err: any) {
    console.error('LOGIN error:', err.message, err.stack)
    return NextResponse.json(
      { error: err.message || 'Login failed' },
      { status: 401 }
    )
  }
}