import { NextRequest, NextResponse } from 'next/server'
import { signup, login } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const user = await signup(email, password, name)
    // Auto-login after signup
    await login(email, password)

    return NextResponse.json({ user })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Signup failed' },
      { status: 400 }
    )
  }
}