import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key', keyLength: 0 });

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    return NextResponse.json({ ok: true, response: message.content[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err), keyLength: apiKey.length, keyStart: apiKey.slice(0, 20) });
  }
}
